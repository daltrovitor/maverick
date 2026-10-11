# Hello World
"""Prepara o boné 3D do site: mesma geometria do modelo de referência, textura nova a partir das fotos.

Uso: python -I scripts/build-polo-model.py

Entrada
  brand-assets/source/pollo-sketchfab.glb   "Baseball Cap" de Scott VanArsdale (Sketchfab), CC BY 4.0
  brand-assets/source/polo-hd-front.png     foto de frente (bordado do jogador de polo)
  brand-assets/source/polo-hd-back.png      foto de trás (bordado POLO)

Saída
  public/models/polo/cap.glb                geometria original intacta; material PBR metal/rugosidade
                                            (o original usa specular-glossiness, que o three.js não lê
                                            mais); textura de tecido preto + bordados projetados
  src/components/cap/capModelAnchors.ts     pontos de interesse no espaço do modelo (câmera/anotações)

A textura não é uma foto colada: o atlas cinza do modelo (costuras, ilhoses, pespontos) é tingido
com a cor do tecido medida nas fotos, e os bordados recortados das fotos são projetados na copa,
como um decalque, nas posições e proporções medidas nas mesmas fotos.
"""
from __future__ import annotations

import io
import json
import math
import struct
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_GLB = ROOT / "brand-assets" / "source" / "pollo-sketchfab.glb"
OUT_GLB = ROOT / "public" / "models" / "polo" / "cap.glb"
OUT_TS = ROOT / "src" / "components" / "cap" / "capModelAnchors.ts"

ATLAS = 2048  # resolução do novo atlas de cor (o original tem 1024)
FABRIC = np.array([44, 44, 46], dtype=np.float32) / 255  # mediana do tecido nas fotos (sRGB)
THREAD = np.array([240, 238, 232], dtype=np.float32) / 255  # linha branca do bordado
STRAP = [0.024, 0.024, 0.026]  # tira traseira (linear)

# Bordados medidos nas fotos: recorte (com margem), caixa da linha bordada e tamanho relativo à
# largura da copa vista de frente/de trás. `rise` = altura do centro, em fração da altura da copa.
PONY = {"photo": "polo-hd-front.png", "box": (340, 286, 70, 121), "ink": (350, 296, 50, 101), "height": 0.229, "rise": 0.587, "offset_x": -0.022}
POLO = {"photo": "polo-hd-back.png", "box": (314, 358, 126, 48), "ink": (322, 365, 109, 33), "width": 0.229, "rise": 0.47, "offset_x": -0.018}

CT = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


# ───────────────────────── Leitura do GLB ─────────────────────────
class Glb:
    def __init__(self, path: Path):
        self.data = path.read_bytes()
        jlen = struct.unpack_from("<I", self.data, 12)[0]
        self.js = json.loads(self.data[20 : 20 + jlen])
        self.bin = 20 + jlen + 8
        self.parent: dict[int, int] = {}
        for i, n in enumerate(self.js["nodes"]):
            for c in n.get("children", []):
                self.parent[c] = i

    def accessor(self, i: int) -> np.ndarray:
        a = self.js["accessors"][i]
        bv = self.js["bufferViews"][a["bufferView"]]
        dt = np.dtype(CT[a["componentType"]])
        n = NC[a["type"]]
        stride = bv.get("byteStride", dt.itemsize * n)
        start = self.bin + bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        count = a["count"]
        raw = np.frombuffer(self.data, dtype=np.uint8, count=stride * (count - 1) + dt.itemsize * n, offset=start)
        rows = np.lib.stride_tricks.as_strided(raw, shape=(count, dt.itemsize * n), strides=(stride, 1)).copy()
        return rows.view(dt).reshape(count, n)

    def image(self, i: int) -> Image.Image:
        bv = self.js["bufferViews"][self.js["images"][i]["bufferView"]]
        start = self.bin + bv.get("byteOffset", 0)
        return Image.open(io.BytesIO(self.data[start : start + bv["byteLength"]]))

    def world(self, i: int) -> np.ndarray:
        def local(k: int) -> np.ndarray:
            m = self.js["nodes"][k].get("matrix")
            return np.array(m, dtype=np.float64).reshape(4, 4).T if m else np.eye(4)

        M = local(i)
        while i in self.parent:
            i = self.parent[i]
            M = local(i) @ M
        return M


class Part:
    """Uma peça do boné já no espaço do mundo (Y para cima, frente em +Z)."""

    def __init__(self, glb: Glb, node: int, name: str):
        n = glb.js["nodes"][node]
        prim = glb.js["meshes"][n["mesh"]]["primitives"][0]
        W = glb.world(node)
        P = glb.accessor(prim["attributes"]["POSITION"]).astype(np.float64)
        N = glb.accessor(prim["attributes"]["NORMAL"]).astype(np.float64)
        self.name = name
        self.material = prim["material"]
        self.pos = (np.c_[P, np.ones(len(P))] @ W.T)[:, :3]
        nrm = N @ np.linalg.inv(W[:3, :3])
        self.nrm = nrm / np.linalg.norm(nrm, axis=1, keepdims=True).clip(1e-9)
        self.uv = glb.accessor(prim["attributes"]["TEXCOORD_0"]).astype(np.float64)
        self.idx = glb.accessor(prim["indices"]).reshape(-1, 3).astype(np.int64)


# ───────────────────────── Rasterização no espaço UV ─────────────────────────
def uv_maps(parts: list[Part], size: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Para cada texel do atlas: posição e normal no mundo (interpoladas) e qual peça o cobre (-1 = nenhuma)."""
    pos = np.zeros((size, size, 3), np.float32)
    nrm = np.zeros((size, size, 3), np.float32)
    owner = np.full((size, size), -1, np.int8)
    for k, part in enumerate(parts):
        T = part.uv[part.idx] * size  # (n, 3, 2) em texels
        for t, tri in zip(T, part.idx):
            x0, y0 = np.floor(t.min(axis=0)).astype(int)
            x1, y1 = np.ceil(t.max(axis=0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, size - 1), min(y1, size - 1)
            if x1 < x0 or y1 < y0:
                continue
            ys, xs = np.mgrid[y0 : y1 + 1, x0 : x1 + 1]
            px, py = xs + 0.5, ys + 0.5
            (ax, ay), (bx, by), (cx, cy) = t
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-12:
                continue
            w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d
            w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d
            w2 = 1 - w0 - w1
            inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not inside.any():
                continue
            W = np.stack([w0, w1, w2], -1)[inside]
            yy, xx = ys[inside], xs[inside]
            pos[yy, xx] = W @ part.pos[tri]
            nn = W @ part.nrm[tri]
            nrm[yy, xx] = nn / np.linalg.norm(nn, axis=1, keepdims=True).clip(1e-9)
            owner[yy, xx] = k
    return pos, nrm, owner


# ───────────────────────── Bordados recortados das fotos ─────────────────────────
def embroidery(photo: str, box: tuple[int, int, int, int], scale: int = 8) -> tuple[np.ndarray, np.ndarray]:
    """Recorta o bordado branco da foto: alfa suave (contorno limpo) e luminância da linha (textura)."""
    x, y, w, h = box
    rgb = np.asarray(Image.open(ROOT / "brand-assets" / "source" / photo).convert("RGB"), np.float32)[y : y + h, x : x + w] / 255
    lum = rgb.mean(axis=2)
    big = cv2.resize(lum, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 0.45 * scale)
    lo, hi = 0.30, 0.62  # tecido ~0,17; linha 0,7–0,95
    alpha = np.clip((big - lo) / (hi - lo), 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)  # borda suave
    detail = cv2.resize(lum, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return alpha, np.clip(detail, 0, 1)


def project_decal(
    pos: np.ndarray,
    nrm: np.ndarray,
    mask: np.ndarray,
    center: np.ndarray,
    forward: np.ndarray,
    size: tuple[float, float],
    alpha: np.ndarray,
    detail: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Projeção ortográfica do decalque ao longo de `forward`, só na superfície voltada para ele."""
    # Eixos do observador: direita = forward × cima (de frente para o boné, a direita dele é +X).
    up_world = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, up_world)
    right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    rel = pos - center
    u = (rel @ right) / size[0] + 0.5
    v = 0.5 - (rel @ up) / size[1]
    depth = rel @ forward
    facing = (nrm @ -forward) > 0.25
    hit = mask & facing & (u >= 0) & (u <= 1) & (v >= 0) & (v <= 1) & (np.abs(depth) < size[1] * 0.6)
    h, w = alpha.shape
    a = np.zeros(mask.shape, np.float32)
    det = np.zeros(mask.shape, np.float32)
    ys, xs = np.nonzero(hit)
    sx = np.clip((u[ys, xs] * (w - 1)).astype(np.float32), 0, w - 1)
    sy = np.clip((v[ys, xs] * (h - 1)).astype(np.float32), 0, h - 1)
    a[ys, xs] = cv2.remap(alpha, sx[None], sy[None], cv2.INTER_LINEAR)[0]
    det[ys, xs] = cv2.remap(detail, sx[None], sy[None], cv2.INTER_LINEAR)[0]
    return a, det


def surface_point(pos: np.ndarray, nrm: np.ndarray, region: np.ndarray, forward: np.ndarray, y: float, x: float) -> np.ndarray:
    """Ponto da superfície (só na região dada) mais próximo do observador, na altura y e coordenada x."""
    facing = region & ((nrm @ -forward) > 0.3)
    P = pos[facing]
    for tol in (0.02, 0.04, 0.08, 0.16):
        near = P[(np.abs(P[:, 1] - y) < tol) & (np.abs(P[:, 0] - x) < tol)]
        if len(near):
            return near[np.argmin(near @ forward)]
    raise SystemExit(f"nenhum ponto da superfície perto de x={x:.2f}, y={y:.2f}")


# ───────────────────────── Escrita do GLB ─────────────────────────
class Writer:
    def __init__(self) -> None:
        self.bin = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []

    def _view(self, payload: bytes, target: int | None = None) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(payload)}
        if target:
            view["target"] = target
        self.bin += payload
        self.views.append(view)
        return len(self.views) - 1

    def accessor(self, arr: np.ndarray, kind: str, target: int, minmax: bool = False) -> int:
        ctype = {np.dtype(np.float32): 5126, np.dtype(np.uint16): 5123, np.dtype(np.uint32): 5125}[arr.dtype]
        acc = {"bufferView": self._view(arr.tobytes(), target), "componentType": ctype, "count": int(arr.shape[0]), "type": kind}
        if minmax:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def image(self, data: bytes) -> int:
        return self._view(data)


def encode(img: Image.Image, fmt: str, **opts) -> bytes:
    buf = io.BytesIO()
    img.save(buf, fmt, **opts)
    return buf.getvalue()


def main() -> None:
    glb = Glb(SRC_GLB)
    nodes = {n.get("name"): i for i, n in enumerate(glb.js["nodes"])}

    def part(group: str, name: str) -> Part:
        holder = nodes[group]
        return Part(glb, glb.js["nodes"][holder]["children"][0], name)

    crown = part("mainCap", "crown")
    brim = part("bill", "brim")
    button = part("topButton", "button")
    liner = part("innerLiner", "sweatband")
    strap_a = part("strapAdjust_male", "strap-a")
    strap_b = part("strapAdjust_female", "strap-b")
    rivet = part("metalButton", "rivet")
    parts = [crown, brim, button, liner, strap_a, strap_b, rivet]

    # Normaliza: copa com meia-largura 1, centrada em x/z, base da copa em y = 0.
    half = (crown.pos[:, 0].max() - crown.pos[:, 0].min()) / 2
    offset = np.array([(crown.pos[:, 0].max() + crown.pos[:, 0].min()) / 2, crown.pos[:, 1].min(), (crown.pos[:, 2].max() + crown.pos[:, 2].min()) / 2])
    for p in parts:
        p.pos = (p.pos - offset) / half
    print("normalizado: meia-largura", round(half, 2), "altura", round(crown.pos[:, 1].max(), 3), "aba até z", round(brim.pos[:, 2].max(), 3))

    # Atlas: posição/normal por texel das peças de tecido.
    fabric_parts = [crown, brim, button, liner]
    pos, nrm, owner = uv_maps(fabric_parts, ATLAS)
    mask = owner >= 0
    on_crown = owner == fabric_parts.index(crown)

    # Tecido: o atlas cinza original vira preto lavado, preservando costuras, ilhoses e trama.
    base = np.asarray(glb.image(0).convert("RGB").resize((ATLAS, ATLAS), Image.Resampling.BICUBIC), np.float32) / 255
    lum = base @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    ref = float(np.median(lum[mask]))
    shade = np.clip(lum / ref, 0.35, 1.6) ** 0.85
    color = FABRIC[None, None, :] * shade[..., None]

    # Bordados projetados (frente e trás), nas proporções das fotos.
    front = np.array([0.0, -math.sin(math.radians(8)), -math.cos(math.radians(8))])  # olhando para -Z (de frente para o boné)
    back = np.array([0.0, -math.sin(math.radians(8)), math.cos(math.radians(8))])
    crown_top = crown.pos[:, 1].max()
    pony_a, pony_d = embroidery(PONY["photo"], PONY["box"])
    pony_h = PONY["height"] * 2 * PONY["box"][3] / PONY["ink"][3]  # copa tem largura 2; recorte tem margem
    pony_w = pony_h * pony_a.shape[1] / pony_a.shape[0]
    pony_y = crown_top * PONY["rise"]
    pony_c = surface_point(pos, nrm, on_crown, front, pony_y, PONY["offset_x"] * 2)
    pa, pd = project_decal(pos, nrm, on_crown, pony_c, front, (pony_w, pony_h), pony_a, pony_d)

    polo_a, polo_d = embroidery(POLO["photo"], POLO["box"])
    polo_w = POLO["width"] * 2 * POLO["box"][2] / POLO["ink"][2]
    polo_h = polo_w * polo_a.shape[0] / polo_a.shape[1]
    polo_y = crown_top * POLO["rise"]
    polo_c = surface_point(pos, nrm, on_crown, back, polo_y, -POLO["offset_x"] * 2)
    qa, qd = project_decal(pos, nrm, on_crown, polo_c, back, (polo_w, polo_h), polo_a, polo_d)

    thread_a = np.maximum(pa, qa)
    thread_d = np.where(pa >= qa, pd, qd)
    thread = THREAD[None, None, :] * (0.78 + 0.22 * np.clip(thread_d / 0.85, 0, 1))[..., None]
    color = color * (1 - thread_a[..., None]) + thread * thread_a[..., None]

    # O fundo do atlas também foi tingido: nada claro vaza nas bordas das ilhas com o mipmap.
    albedo = Image.fromarray((np.clip(color, 0, 1) * 255).astype(np.uint8), "RGB")

    # Relevo do bordado somado ao mapa normal original.
    normal = np.asarray(glb.image(2).convert("RGB").resize((ATLAS, ATLAS), Image.Resampling.BICUBIC), np.float32) / 255 * 2 - 1
    height = cv2.GaussianBlur(thread_a, (0, 0), 1.6)
    gy, gx = np.gradient(height)
    k = 2.2
    bump = np.stack([-gx * k, gy * k, np.ones_like(gx)], -1)
    combined = np.stack([normal[..., 0] + bump[..., 0], normal[..., 1] + bump[..., 1], normal[..., 2]], -1)
    combined /= np.linalg.norm(combined, axis=2, keepdims=True).clip(1e-6)
    normal_img = Image.fromarray(((combined * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8), "RGB")

    # ── Monta o GLB: mesma geometria, sem os anexos não usados (tangentes, UV 1/2, luzes/câmeras).
    w = Writer()
    tex_albedo = w.image(encode(albedo, "JPEG", quality=88, optimize=True, progressive=False))
    tex_normal = w.image(encode(normal_img, "JPEG", quality=92, optimize=True, progressive=False))
    images = [{"bufferView": tex_albedo, "mimeType": "image/jpeg"}, {"bufferView": tex_normal, "mimeType": "image/jpeg"}]
    textures = [{"sampler": 0, "source": 0}, {"sampler": 0, "source": 1}]
    materials = [
        {
            "name": "fabric",
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.92},
            "normalTexture": {"index": 1, "scale": 0.8},
        },
        {"name": "strap", "pbrMetallicRoughness": {"baseColorFactor": STRAP + [1.0], "metallicFactor": 0.0, "roughnessFactor": 0.88}, "doubleSided": True},
        {"name": "rivet", "pbrMetallicRoughness": {"baseColorFactor": [0.02, 0.02, 0.022, 1.0], "metallicFactor": 0.6, "roughnessFactor": 0.5}, "doubleSided": True},
    ]
    material_of = {"crown": 0, "brim": 0, "button": 0, "sweatband": 0, "strap-a": 1, "strap-b": 1, "rivet": 2}
    meshes, gnodes = [], []
    for p in parts:
        attrs = {
            "POSITION": w.accessor(p.pos.astype(np.float32), "VEC3", 34962, minmax=True),
            "NORMAL": w.accessor(p.nrm.astype(np.float32), "VEC3", 34962),
            "TEXCOORD_0": w.accessor(p.uv.astype(np.float32), "VEC2", 34962),
        }
        flat = p.idx.reshape(-1)
        idx = flat.astype(np.uint16) if flat.max() < 65535 else flat.astype(np.uint32)
        prim = {"attributes": attrs, "indices": w.accessor(idx, "SCALAR", 34963), "material": material_of[p.name], "mode": 4}
        meshes.append({"name": p.name, "primitives": [prim]})
        gnodes.append({"name": p.name, "mesh": len(meshes) - 1})
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "Maverick scripts/build-polo-model.py",
            "copyright": "\"Baseball Cap\" by Scott VanArsdale (https://sketchfab.com/vanart), CC BY 4.0 — textura alterada pela Maverick",
            "extras": {"source": "https://sketchfab.com/3d-models/baseball-cap-1c1d34d73fd94e6b9e8f82b1eb7194a0", "license": "CC-BY-4.0"},
        },
        "scene": 0,
        "scenes": [{"nodes": [len(gnodes)]}],
        "nodes": gnodes + [{"name": "cap", "children": list(range(len(gnodes)))}],
        "meshes": meshes,
        "materials": materials,
        "textures": textures,
        "images": images,
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "accessors": w.accessors,
        "bufferViews": w.views,
        "buffers": [{"byteLength": len(w.bin)}],
    }
    while len(w.bin) % 4:
        w.bin.append(0)
    gltf["buffers"][0]["byteLength"] = len(w.bin)
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(w.bin)
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    with OUT_GLB.open("wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON") + js)
        f.write(struct.pack("<I4s", len(w.bin), b"BIN\x00") + bytes(w.bin))
    albedo.save(ROOT / ".tmp-check" / "glb" / "albedo-new.png")

    # ── Âncoras (espaço do modelo normalizado) para câmera e anotações.
    def surf(forward: np.ndarray, y: float, x: float) -> list[float]:
        return [round(float(v), 4) for v in surface_point(pos, nrm, on_crown, forward, y, x)]

    side = np.array([-1.0, 0.0, 0.0])  # olhando para -X: lado direito do boné (x positivo)
    brim_top = brim.pos[brim.nrm[:, 1] > 0.6]
    brim_mid = brim_top[np.argmin(np.abs(brim_top[:, 0]) + np.abs(brim_top[:, 2] - (brim.pos[:, 2].max() * 0.82)))]
    strap_c = np.vstack([strap_a.pos, strap_b.pos]).mean(axis=0)
    anchors = {
        "pony": [round(float(v), 4) for v in pony_c],
        "polo": [round(float(v), 4) for v in polo_c],
        "brim": [round(float(v), 4) for v in brim_mid],
        "eyelet": surf(side, crown_top * 0.78, 0.9),
        "seam": surf(side, crown_top * 0.5, 0.95),
        "strap": [round(float(v), 4) for v in strap_c],
        "button": [0.0, round(float(button.pos[:, 1].max()), 4), round(float(button.pos[:, 2].mean()), 4)],
    }
    bounds = {
        "min": [round(float(v), 4) for v in np.vstack([p.pos for p in parts]).min(axis=0)],
        "max": [round(float(v), 4) for v in np.vstack([p.pos for p in parts]).max(axis=0)],
    }
    lines = "\n".join(f"  {k}: [{', '.join(str(v) for v in val)}]," for k, val in anchors.items())
    OUT_TS.write_text(
        "// Hello World\n"
        "/* Gerado por scripts/build-polo-model.py — não edite à mão. Espaço do modelo normalizado:\n"
        "   copa com meia-largura 1, base da copa em y = 0, frente (aba) em +Z. */\n\n"
        "export type ModelAnchorId = \"pony\" | \"polo\" | \"brim\" | \"eyelet\" | \"seam\" | \"strap\" | \"button\";\n\n"
        "export const MODEL_ANCHORS: Readonly<Record<ModelAnchorId, readonly [number, number, number]>> = {\n"
        f"{lines}\n}};\n\n"
        f"export const MODEL_BOUNDS = {{ min: [{', '.join(map(str, bounds['min']))}], max: [{', '.join(map(str, bounds['max']))}] }} as const;\n\n"
        "/** Crédito exigido pela licença CC BY 4.0 do modelo de referência. */\n"
        "export const MODEL_CREDIT = {\n"
        '  title: "Baseball Cap",\n'
        '  author: "Scott VanArsdale",\n'
        '  url: "https://sketchfab.com/3d-models/baseball-cap-1c1d34d73fd94e6b9e8f82b1eb7194a0",\n'
        '  license: "CC BY 4.0",\n'
        '  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",\n'
        "} as const;\n",
        encoding="utf-8",
    )
    print(f"ok · {OUT_GLB.relative_to(ROOT)} {OUT_GLB.stat().st_size / 1e6:.2f} MB · âncoras {list(anchors)}")


if __name__ == "__main__":
    main()
