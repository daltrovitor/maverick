# Hello World
"""Vetoriza o logo oficial da Maverick em SVG estruturado, peça por peça.

Uso: python -I scripts/vectorize-logo.py brand-assets/source/maverick-logo.png

O arquivo oficial é pequeno (515×324 px). O traçado é feito sobre o canal de tinta ampliado
e levemente suavizado, o que remove o serrilhado do raster sem inventar formas. Cada elemento
vira um caminho próprio (monograma, letras do nome, assinatura, fios e ano), para poder ser
animado separadamente na entrada da página inicial.

Gera:
  public/brand/maverick-logo.svg                logo completo, em grupos nomeados
  public/brand/maverick-monogram.svg            só o "M" com o cavalo
  public/brand/maverick-logo@2x.png             raster transparente (fallback / JSON-LD)
  src/components/brand/maverickLogoGeometry.ts  proporções (leve; usado no cabeçalho)
  src/components/brand/maverickLogoPaths.ts     caminhos + estilhaços da entrada
"""
from __future__ import annotations

import math
import random
import sys
from dataclasses import dataclass
from html import escape
from pathlib import Path

import cv2
import numpy as np
import potrace
from PIL import Image
from scipy.ndimage import distance_transform_edt
from scipy.spatial import Delaunay

ROOT = Path(__file__).resolve().parent.parent
INK = "#26170A"  # mediana dos pixels escuros do arquivo oficial (= --color-ink)
BG = np.array([250, 246, 235], dtype=np.float32)  # creme do arquivo oficial
INK_RGB = np.array([38, 23, 8], dtype=np.float32)

SCALE = 12  # ampliação usada no traçado
SMOOTH = 0.3  # desfoque antes do limiar, em px do original
LEVEL = 0.5  # limiar do canal de tinta (formas grandes)
LEVEL_SMALL = 0.38  # assinatura e ano têm traço de ~1 px: limiar menor preserva o peso
PAD = 2.0  # respiro em volta do logo completo (px do original)

# Faixas verticais do arquivo oficial (px): monograma, nome, assinatura, fios + ano.
BAND_MONOGRAM = (40, 170)
BAND_WORDMARK = (170, 222)
BAND_TAGLINE = (222, 244)
BAND_FOUNDED = (244, 270)
# O ponto de "EST." é claro demais para o limiar: centro medido no arquivo original.
DOT_HINT = (251.6, 254.6)


@dataclass
class Glyph:
    name: str
    labels: list[int]
    paths: list[str]
    box: tuple[float, float, float, float]  # x, y, w, h no sistema do logo


def ink_alpha(img: Image.Image) -> np.ndarray:
    """Alpha 0..1 proporcional à distância do pixel ao creme de fundo."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    span = np.linalg.norm(BG - INK_RGB)
    return np.clip(np.linalg.norm(rgb - BG, axis=2) / span, 0.0, 1.0)


def fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def trace(mask: np.ndarray, ox: float, oy: float, k: float = 1.0) -> list[str]:
    """Traça uma máscara ampliada; devolve subcaminhos em px do original (× k, deslocados por ox, oy)."""
    # potracer trata False como "tinta": invertemos para traçar apenas a peça.
    bitmap = potrace.Bitmap(~mask)
    curves = bitmap.trace(
        turdsize=24,
        turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,
        alphamax=1.05,
        opticurve=True,
        opttolerance=0.6,
    )

    def pt(p) -> str:
        return f"{fmt(p.x / SCALE * k + ox)},{fmt(p.y / SCALE * k + oy)}"

    paths: list[str] = []
    for curve in curves:
        parts = [f"M{pt(curve.start_point)}"]
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f"L{pt(seg.c)}L{pt(seg.end_point)}")
            else:
                parts.append(f"C{pt(seg.c1)} {pt(seg.c2)} {pt(seg.end_point)}")
        parts.append("Z")
        paths.append("".join(parts))
    return paths


class Tracer:
    """Recorta cada peça na imagem ampliada e a traça isoladamente.

    Pixels de tinta ampliados são atribuídos ao componente original mais próximo, então letras
    que quase se tocam (o A e o V do nome) continuam separadas e com contorno suave.
    """

    def __init__(self, alpha: np.ndarray, labels: np.ndarray, origin: tuple[float, float]):
        self.alpha = alpha
        self.labels = labels
        self.ox, self.oy = origin
        big = cv2.resize(alpha, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_CUBIC)
        self.big = np.clip(cv2.GaussianBlur(big, (0, 0), SMOOTH * SCALE), 0.0, 1.0)

    def mask(self, labels: list[int], level: float, margin: int = 3) -> tuple[np.ndarray, int, int]:
        ys, xs = np.nonzero(np.isin(self.labels, labels))
        x0, y0 = max(int(xs.min()) - margin, 0), max(int(ys.min()) - margin, 0)
        x1 = min(int(xs.max()) + margin + 1, self.labels.shape[1])
        y1 = min(int(ys.max()) + margin + 1, self.labels.shape[0])
        seeds = cv2.resize(
            self.labels[y0:y1, x0:x1].astype(np.int32), None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_NEAREST
        )
        _, (iy, ix) = distance_transform_edt(seeds == 0, return_indices=True)
        nearest = seeds[iy, ix]
        window = self.big[y0 * SCALE : y1 * SCALE, x0 * SCALE : x1 * SCALE]
        return (window > level) & np.isin(nearest, labels), x0, y0

    def glyph(self, name: str, labels: list[int], level: float) -> Glyph:
        mask, x0, y0 = self.mask(labels, level)
        paths = trace(mask, x0 - self.ox, y0 - self.oy)
        ys, xs = np.nonzero(mask)
        box = (
            xs.min() / SCALE + x0 - self.ox,
            ys.min() / SCALE + y0 - self.oy,
            (xs.max() - xs.min() + 1) / SCALE,
            (ys.max() - ys.min() + 1) / SCALE,
        )
        return Glyph(name, labels, paths, tuple(round(v, 2) for v in box))  # type: ignore[arg-type]


def components(alpha: np.ndarray) -> tuple[np.ndarray, list[dict]]:
    mask = (alpha > 0.42).astype(np.uint8)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, connectivity=8)
    comps = [
        {"label": i, "x": int(stats[i, 0]), "y": int(stats[i, 1]), "w": int(stats[i, 2]), "h": int(stats[i, 3]),
         "cx": float(cents[i, 0]), "cy": float(cents[i, 1])}
        for i in range(1, n)
    ]
    return labels, comps


def in_band(c: dict, band: tuple[int, int]) -> bool:
    return band[0] <= c["cy"] < band[1]


def cluster_x(comps: list[dict], gap: float) -> list[list[dict]]:
    """Agrupa componentes em glifos pela sobreposição/proximidade horizontal."""
    groups: list[list[dict]] = []
    for c in sorted(comps, key=lambda c: c["x"]):
        if groups and c["x"] <= max(g["x"] + g["w"] for g in groups[-1]) + gap:
            groups[-1].append(c)
        else:
            groups.append([c])
    return groups


def measure_rule(alpha: np.ndarray, c: dict, origin: tuple[float, float]) -> tuple[float, float, float, float]:
    y0, y1 = c["y"] - 2, c["y"] + c["h"] + 2
    band = alpha[y0:y1, c["x"] - 2 : c["x"] + c["w"] + 2]
    cols = np.nonzero(band.max(axis=0) > 0.3)[0]
    x0 = c["x"] - 2 + cols.min()
    x1 = c["x"] - 2 + cols.max() + 1
    core = band[:, cols.min() + 2 : cols.max() - 1]
    thickness = float(np.median(core.sum(axis=0)))
    rows = np.arange(y0, y1, dtype=np.float32)[:, None] + 0.5
    yc = float((core * rows).sum() / core.sum())
    ox, oy = origin
    return (round(x0 - ox, 2), round(yc - thickness / 2 - oy, 2), round(float(x1 - x0), 2), round(thickness, 2))


def measure_dot(alpha: np.ndarray, origin: tuple[float, float]) -> tuple[float, float, float]:
    hx, hy = DOT_HINT
    x0, y0 = int(hx) - 3, int(hy) - 3
    win = alpha[y0 : y0 + 7, x0 : x0 + 7].astype(np.float64)
    win = np.where(win > 0.12, win, 0.0)
    mass = win.sum()
    yy, xx = np.mgrid[0:7, 0:7]
    cx = float((win * (xx + 0.5)).sum() / mass) + x0
    cy = float((win * (yy + 0.5)).sum() / mass) + y0
    r = max(math.sqrt(mass / math.pi), 0.9)
    ox, oy = origin
    return round(cx - ox, 2), round(cy - oy, 2), round(r, 2)


def measure_registered(alpha: np.ndarray, c: dict, origin: tuple[float, float]) -> tuple[float, float, float, float]:
    """Anel do ®: centro, raio médio e espessura medidos no perfil radial do canal de tinta."""
    x0, y0 = c["x"] - 3, c["y"] - 3
    win = alpha[y0 : y0 + c["h"] + 6, x0 : x0 + c["w"] + 6].astype(np.float64)
    yy, xx = np.mgrid[0 : win.shape[0], 0 : win.shape[1]] + 0.5
    cx, cy = x0 + c["w"] / 2 + 3, y0 + c["h"] / 2 + 3
    for _ in range(3):  # refina o centro só com os pixels do anel
        r = np.hypot(xx + x0 - cx, yy + y0 - cy)
        ring = win * (r > 2.6) * (win > 0.15)
        cx = float((ring * (xx + x0)).sum() / ring.sum())
        cy = float((ring * (yy + y0)).sum() / ring.sum())
    r = np.hypot(xx + x0 - cx, yy + y0 - cy)
    ring = win * (r > 2.6)
    r_mid = float((ring * r).sum() / ring.sum())
    thickness = float(ring.sum() / (2 * math.pi * r_mid))
    ox, oy = origin
    return round(cx - ox, 2), round(cy - oy, 2), round(r_mid, 2), round(thickness, 2)


def circle_path(cx: float, cy: float, r: float) -> str:
    return (
        f"M{fmt(cx - r)},{fmt(cy)}A{fmt(r)},{fmt(r)} 0 1 0 {fmt(cx + r)},{fmt(cy)}"
        f"A{fmt(r)},{fmt(r)} 0 1 0 {fmt(cx - r)},{fmt(cy)}Z"
    )


# ───────────────────────── Estilhaços do monograma (entrada) ─────────────────────────
TONES = ["#26170a", "#3b2715", "#553b22", "#6e5033"]
GOLD = "#b88a2e"


# Malha dos estilhaços: grade 3×2 com 2 pontos por borda (~22 triângulos, facetas largas e regulares).
SHARD_SEED, SHARD_COLS, SHARD_ROWS, SHARD_EDGE = 3, 3, 2, 2
SHARD_OVERLAP = 0.8  # px do original: cada estilhaço invade o vizinho e esconde o antisserrilhado das bordas


def build_shards(mask: np.ndarray, box: tuple[float, float, float, float], seed: int = SHARD_SEED) -> list[dict]:
    """Triangulação irregular (estilo low-poly) da caixa do monograma.

    Cada triângulo vira um estilhaço: recorte do monograma que entra voando de fora, girando,
    até se encaixar. Só ficam os triângulos que tocam a tinta. Coordenadas locais do monograma.
    """
    rng = random.Random(seed)
    _, _, w, h = box
    pts: list[tuple[float, float]] = [(0, 0), (w, 0), (0, h), (w, h)]
    for i in range(1, SHARD_EDGE + 1):
        f = i / (SHARD_EDGE + 1) + rng.uniform(-0.08, 0.08)
        pts += [(w * f, 0), (w * (1 - f), h)]
        g = i / (SHARD_EDGE + 1) + rng.uniform(-0.08, 0.08)
        pts += [(0, h * g), (w, h * (1 - g))]
    cols, rows = SHARD_COLS, SHARD_ROWS
    for r in range(rows):
        for c in range(cols):
            jx, jy = rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)
            pts.append((w * (c + 0.5 + jx) / cols, h * (r + 0.5 + jy) / rows))
    tri = Delaunay(np.array(pts))

    mh, mw = mask.shape
    sx, sy = mw / w, mh / h
    center = (w * 0.52, h * 0.5)
    light = np.array([-0.45, -0.65, 0.62])
    light /= np.linalg.norm(light)
    shards: list[dict] = []
    for simplex in tri.simplices:
        poly = np.array([pts[i] for i in simplex])
        canvas = np.zeros_like(mask, dtype=np.uint8)
        cv2.fillPoly(canvas, [np.round(poly * [sx, sy]).astype(np.int32)], 1)
        if not (canvas.astype(bool) & mask).any():
            continue
        cx, cy = poly.mean(axis=0)
        # Expande a partir do centro: sem frestas quando os estilhaços se encontram.
        grown = []
        for x, y in poly:
            vx, vy = x - cx, y - cy
            n = math.hypot(vx, vy) or 1.0
            grown.append((x + vx / n * SHARD_OVERLAP, y + vy / n * SHARD_OVERLAP))
        ang = math.atan2(cy - center[1], cx - center[0]) + rng.uniform(-0.5, 0.5)
        dist = w * rng.uniform(0.55, 1.05)
        normal = np.array([rng.uniform(-0.7, 0.7), rng.uniform(-0.7, 0.7), 1.0])
        normal /= np.linalg.norm(normal)
        shade = float(np.clip(np.dot(normal, light), 0, 1))
        tone = TONES[min(int(shade * len(TONES)), len(TONES) - 1)]
        sweep = 0.72 * (cx / w) + 0.28 * (1 - cy / h)
        shards.append({
            "points": " ".join(f"{fmt(x)},{fmt(y)}" for x, y in grown),
            "cx": round(float(cx), 2),
            "cy": round(float(cy), 2),
            "dx": round(math.cos(ang) * dist, 1),
            "dy": round(math.sin(ang) * dist, 1),
            "rot": rng.choice([-1, 1]) * rng.randint(38, 112),
            "delay": int(sweep * 520 + rng.uniform(0, 70)),
            "tone": tone,
        })
    # Dois estilhaços em dourado (o acento da marca), não mais: é brilho, não estampa.
    for i in rng.sample(range(len(shards)), 2):
        shards[i]["tone"] = GOLD
    shards.sort(key=lambda s: s["delay"])
    return shards


# ───────────────────────── Saída ─────────────────────────
def ts_glyph(g: Glyph) -> str:
    x, y, w, h = g.box
    return f'  {{ name: "{g.name}", d: "{"".join(g.paths)}", x: {x}, y: {y}, w: {w}, h: {h} }},'


def write_outputs(
    full: tuple[float, float],
    mono_box: tuple[float, float, float, float],
    mono_d: str,
    shards: list[dict],
    wordmark: list[Glyph],
    registered: Glyph,
    tagline: list[Glyph],
    founded: list[Glyph],
    rules: list[tuple[float, float, float, float]],
) -> None:
    W, H = full
    mx, my, mw, mh = mono_box
    brand = ROOT / "public" / "brand"
    brand.mkdir(parents=True, exist_ok=True)

    def group(gid: str, glyphs: list[Glyph]) -> str:
        return f'<g id="{gid}">' + "".join(f'<path d="{"".join(g.paths)}"/>' for g in glyphs) + "</g>"

    rules_svg = "".join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}"/>' for x, y, w, h in rules)
    founded_svg = "".join('<path d="' + "".join(g.paths) + '"/>' for g in founded)
    title = escape("Maverick — Headwear & Lifestyle · Est. 2026", quote=True)
    full_svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(W)} {fmt(H)}" role="img" aria-label="{title}">'
        f"<title>{title}</title>"
        f'<g fill="{INK}" fill-rule="evenodd">'
        f'<g id="monograma" transform="translate({fmt(mx)} {fmt(my)})"><path d="{mono_d}"/></g>'
        f'{group("nome", wordmark + [registered])}'
        f'{group("assinatura", tagline)}'
        f'<g id="fundacao">{rules_svg}{founded_svg}</g>'
        "</g></svg>\n"
    )
    (brand / "maverick-logo.svg").write_text(full_svg, encoding="utf-8")
    mono_svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(mw)} {fmt(mh)}" role="img" aria-label="Maverick">'
        f'<title>Maverick</title><path fill="{INK}" fill-rule="evenodd" d="{mono_d}"/></svg>\n'
    )
    (brand / "maverick-monogram.svg").write_text(mono_svg, encoding="utf-8")

    header = (
        "// Hello World\n"
        "/* Gerado por scripts/vectorize-logo.py a partir de brand-assets/source/maverick-logo.png.\n"
        "   Não edite à mão: rode o script de novo. Unidades = px do arquivo oficial. */\n\n"
    )
    geometry = header + (
        "/** Logo completo: viewBox `0 0 w h`. */\n"
        f"export const LOGO_BOX = {{ w: {fmt(W)}, h: {fmt(H)} }} as const;\n\n"
        "/** Monograma dentro do logo completo; o SVG do monograma usa viewBox `0 0 w h`. */\n"
        f"export const MONOGRAM_BOX = {{ x: {fmt(mx)}, y: {fmt(my)}, w: {fmt(mw)}, h: {fmt(mh)} }} as const;\n"
    )
    (ROOT / "src" / "components" / "brand" / "maverickLogoGeometry.ts").write_text(geometry, encoding="utf-8")

    shard_lines = "\n".join(
        f'  {{ points: "{s["points"]}", cx: {s["cx"]}, cy: {s["cy"]}, dx: {s["dx"]}, dy: {s["dy"]}, '
        f'rot: {s["rot"]}, delay: {s["delay"]}, tone: "{s["tone"]}" }},'
        for s in shards
    )
    rule_lines = "\n".join(f"  {{ x: {x}, y: {y}, w: {w}, h: {h} }}," for x, y, w, h in rules)
    paths = header + (
        "/** Peça do logo no sistema do logo completo (caixa = limites do traço). */\n"
        "export interface LogoGlyph {\n  readonly name: string;\n  readonly d: string;\n"
        "  readonly x: number;\n  readonly y: number;\n  readonly w: number;\n  readonly h: number;\n}\n\n"
        "/** Recorte triangular do monograma (coordenadas locais) e de onde ele entra voando. */\n"
        "export interface LogoShard {\n  readonly points: string;\n  readonly cx: number;\n  readonly cy: number;\n"
        "  readonly dx: number;\n  readonly dy: number;\n  readonly rot: number;\n  /** ms */\n"
        "  readonly delay: number;\n  /** Tom durante o voo; assenta no café do logo. */\n  readonly tone: string;\n}\n\n"
        "export interface LogoRule {\n  readonly x: number;\n  readonly y: number;\n  readonly w: number;\n  readonly h: number;\n}\n\n"
        f'export const LOGO_INK = "{INK.lower()}";\n\n'
        "/** \"M\" com o cavalo, em coordenadas locais (viewBox de MONOGRAM_BOX). */\n"
        f'export const MONOGRAM_PATH = "{mono_d}";\n\n'
        f"export const MONOGRAM_SHARDS: readonly LogoShard[] = [\n{shard_lines}\n];\n\n"
        f"export const WORDMARK: readonly LogoGlyph[] = [\n" + "\n".join(ts_glyph(g) for g in wordmark) + "\n];\n\n"
        f"export const REGISTERED: LogoGlyph = {ts_glyph(registered).strip().rstrip(',')};\n\n"
        f"export const TAGLINE: readonly LogoGlyph[] = [\n" + "\n".join(ts_glyph(g) for g in tagline) + "\n];\n\n"
        f"export const FOUNDED: readonly LogoGlyph[] = [\n" + "\n".join(ts_glyph(g) for g in founded) + "\n];\n\n"
        f"/** Fios à esquerda e à direita de \"EST. 2026\". */\n"
        f"export const RULES: readonly [LogoRule, LogoRule] = [\n{rule_lines}\n];\n"
    )
    (ROOT / "src" / "components" / "brand" / "maverickLogoPaths.ts").write_text(paths, encoding="utf-8")


def main(src: str) -> None:
    original = Image.open(src)
    alpha = ink_alpha(original)
    labels, comps = components(alpha)

    ink = alpha > 0.42
    ys, xs = np.nonzero(ink)
    origin = (float(xs.min()) - PAD, float(ys.min()) - PAD)
    full = (float(xs.max() + 1 - xs.min()) + 2 * PAD, float(ys.max() + 1 - ys.min()) + 2 * PAD)
    tracer = Tracer(alpha, labels, origin)

    mono_comps = [c for c in comps if in_band(c, BAND_MONOGRAM)]
    word_comps = [c for c in comps if in_band(c, BAND_WORDMARK)]
    tag_comps = [c for c in comps if in_band(c, BAND_TAGLINE)]
    found_comps = [c for c in comps if in_band(c, BAND_FOUNDED)]

    # Monograma: uma peça só (as três formas do "M" + cavalo), traçada já em coordenadas locais.
    mono_labels = [c["label"] for c in mono_comps]
    mx, my, mw, mh = tracer.glyph("monograma", mono_labels, LEVEL).box
    mono_box = (round(mx - 0.5, 2), round(my - 0.5, 2), round(mw + 1, 2), round(mh + 1, 2))
    mono_mask, wx0, wy0 = tracer.mask(mono_labels, LEVEL)
    mono_d = "".join(trace(mono_mask, wx0 - origin[0] - mono_box[0], wy0 - origin[1] - mono_box[1]))

    # Nome: uma letra por componente; o ® (pequeno, no alto) fica à parte.
    reg_comps = [c for c in word_comps if c["h"] < 15]
    letters = sorted([c for c in word_comps if c["h"] >= 15], key=lambda c: c["x"])
    names = list("MAVERICK")
    if len(letters) != len(names):
        raise SystemExit(f"esperava {len(names)} letras no nome, encontrei {len(letters)}")
    wordmark = [tracer.glyph(n, [c["label"]], LEVEL) for n, c in zip(names, letters)]
    # ®: o "R" interno tem ~3 px no arquivo e vira borrão no traçado. O anel é medido e o R é o
    # próprio R do nome em miniatura — mesmo desenho da marca, nítido em qualquer tamanho.
    rcx, rcy, r_mid, r_t = measure_registered(alpha, reg_comps[0], origin)
    r_letter = wordmark[names.index("R")]
    k = (r_mid - r_t / 2) * 0.86 / r_letter.box[3]
    r_mask, rx0, ry0 = tracer.mask(r_letter.labels, LEVEL)
    lx, ly, lw, lh = r_letter.box
    mini_r = trace(
        r_mask,
        (rx0 - origin[0] - lx) * k + rcx - lw * k / 2,
        (ry0 - origin[1] - ly) * k + rcy - lh * k / 2,
        k,
    )
    r_out, r_in = r_mid + r_t / 2, r_mid - r_t / 2
    registered = Glyph(
        "®",
        [],
        [circle_path(rcx, rcy, r_out), circle_path(rcx, rcy, r_in), *mini_r],
        (round(rcx - r_out, 2), round(rcy - r_out, 2), round(2 * r_out, 2), round(2 * r_out, 2)),
    )

    # Assinatura: HEADWEAR & LIFESTYLE (18 glifos).
    tag_groups = cluster_x(tag_comps, gap=1.5)
    tag_names = [ch for ch in "HEADWEAR&LIFESTYLE"]
    if len(tag_groups) != len(tag_names):
        raise SystemExit(f"esperava {len(tag_names)} glifos na assinatura, encontrei {len(tag_groups)}")
    tagline = [tracer.glyph(n, [c["label"] for c in g], LEVEL_SMALL) for n, g in zip(tag_names, tag_groups)]

    # Fundação: fios (traços longos) + EST. 2026 (o ponto é desenhado como círculo).
    rule_comps = sorted([c for c in found_comps if c["w"] > 8 * c["h"]], key=lambda c: c["x"])
    text_comps = [c for c in found_comps if c not in rule_comps]
    rules = [measure_rule(alpha, c, origin) for c in rule_comps]
    text_groups = cluster_x(text_comps, gap=1.0)
    dot = measure_dot(alpha, origin)
    found_names = ["E", "S", "T", "2", "0", "2", "6"]
    if len(text_groups) != len(found_names) or len(rules) != 2:
        raise SystemExit(f"fundação: {len(text_groups)} glifos e {len(rules)} fios (esperava 7 e 2)")
    founded = [tracer.glyph(n, [c["label"] for c in g], LEVEL_SMALL) for n, g in zip(found_names, text_groups)]
    dot_glyph = Glyph(".", [], [circle_path(*dot)], (round(dot[0] - dot[2], 2), round(dot[1] - dot[2], 2), round(2 * dot[2], 2), round(2 * dot[2], 2)))
    founded.insert(3, dot_glyph)

    # Estilhaços: máscara do monograma recortada na caixa local.
    gx0 = (mono_box[0] + origin[0] - wx0) * SCALE
    gy0 = (mono_box[1] + origin[1] - wy0) * SCALE
    local = np.zeros((int(mono_box[3] * SCALE), int(mono_box[2] * SCALE)), dtype=bool)
    sy0, sx0 = int(round(gy0)), int(round(gx0))
    crop = mono_mask[max(sy0, 0) : max(sy0, 0) + local.shape[0], max(sx0, 0) : max(sx0, 0) + local.shape[1]]
    local[: crop.shape[0], : crop.shape[1]] = crop
    shards = build_shards(local, mono_box)

    write_outputs(full, mono_box, mono_d, shards, wordmark, registered, tagline, founded, rules)

    # Raster transparente (fallback / JSON-LD), mesmo enquadramento do SVG completo.
    big = cv2.resize(alpha, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    rgba = np.zeros((big.shape[0], big.shape[1], 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 38, 23, 8
    rgba[..., 3] = (np.clip(big, 0, 1) * 255).astype(np.uint8)
    x0, y0 = int(origin[0] * 4), int(origin[1] * 4)
    Image.fromarray(rgba, "RGBA").crop((x0, y0, x0 + int(full[0] * 4), y0 + int(full[1] * 4))).save(
        ROOT / "public" / "brand" / "maverick-logo@2x.png", optimize=True
    )
    print(f"ok · logo {full[0]:.0f}×{full[1]:.0f} · monograma {mono_box[2]}×{mono_box[3]} · {len(shards)} estilhaços")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: vectorize-logo.py <logo.png>")
    main(sys.argv[1])
