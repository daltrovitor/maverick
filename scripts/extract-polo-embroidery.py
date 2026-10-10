# Hello World
"""Vetoriza os bordados brancos do boné Polo a partir das fotos de referência.

Uso: python -I scripts/extract-polo-embroidery.py brand-assets/source public/models/polo

As fotos fornecidas são pequenas (~240 px). Em vez de ampliar pixels borrados, o contorno de
cada bordado é traçado (potrace) a partir dos próprios pixels da foto e renderizado em alta
resolução com textura de ponto cetim. Nada é redesenhado à mão: a forma vem da fotografia.

Gera, para "pony" (frente) e "polo" (traseira):
  <nome>.png         cor do fio (branco da foto) com alfa
  <nome>-height.png  relevo do bordado (mais alto no miolo dos traços)
  <nome>.json        proporção e região de origem na foto
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFilter

UPSCALE = 12
OUT_HEIGHT = 1024

# (arquivo, recorte x0,y0,x1,y1 com margem) medidos nas fotos de referência
SOURCES = {
    "pony": ("polo-front.png", (100, 80, 131, 125)),
    "polo": ("polo-back.png", (150, 80, 216, 110)),
}


def white_mask(rgb: np.ndarray) -> np.ndarray:
    """Probabilidade de o pixel ser linha branca sobre tecido preto (neutro e claro)."""
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    return np.clip((lum - 95.0) / 70.0, 0, 1) * (sat < 40)


def trace(mask: np.ndarray) -> list:
    # potracer trata False como tinta: invertemos para traçar apenas o bordado.
    bitmap = potrace.Bitmap(~mask)
    return bitmap.trace(turdsize=int(4 * UPSCALE), turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.25)


def curves_to_polygons(curves, scale: float, steps: int = 10) -> list[list[tuple[float, float]]]:
    polys = []
    for curve in curves:
        pts = [(curve.start_point.x * scale, curve.start_point.y * scale)]
        last = curve.start_point
        for seg in curve.segments:
            if seg.is_corner:
                pts.append((seg.c.x * scale, seg.c.y * scale))
                pts.append((seg.end_point.x * scale, seg.end_point.y * scale))
            else:
                for i in range(1, steps + 1):
                    t = i / steps
                    mt = 1 - t
                    x = mt**3 * last.x + 3 * mt**2 * t * seg.c1.x + 3 * mt * t**2 * seg.c2.x + t**3 * seg.end_point.x
                    y = mt**3 * last.y + 3 * mt**2 * t * seg.c1.y + 3 * mt * t**2 * seg.c2.y + t**3 * seg.end_point.y
                    pts.append((x * scale, y * scale))
            last = seg.end_point
        polys.append(pts)
    return polys


def render(name: str, src_dir: Path, out_dir: Path) -> dict:
    file, crop = SOURCES[name]
    photo = Image.open(src_dir / file).convert("RGB")
    region = photo.crop(crop)
    big = region.resize((region.width * UPSCALE, region.height * UPSCALE), Image.Resampling.LANCZOS)
    prob = white_mask(np.asarray(big, dtype=np.float32))
    # Letras serifadas pedem menos suavização que o pônei.
    prob = cv2.GaussianBlur(prob, (0, 0), UPSCALE * (0.22 if name == "polo" else 0.35))
    mask = prob > (0.5 if name == "polo" else 0.42)

    # Mantém só as regiões conectadas relevantes (descarta reflexos soltos do tecido).
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    keep = np.zeros_like(mask)
    total = mask.sum()
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= 0.015 * total:
            keep |= labels == label
    if name == "polo":
        # Endireita a linha de base (na foto o texto acompanha a curvatura do gomo).
        pts = np.column_stack(np.nonzero(keep)[::-1]).astype(np.float32)
        (cx, cy), (w, h), angle = cv2.minAreaRect(pts)
        if w < h:
            angle -= 90
        rot = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        keep = cv2.warpAffine(keep.astype(np.uint8), rot, (keep.shape[1], keep.shape[0]), flags=cv2.INTER_NEAREST) > 0
    ys, xs = np.nonzero(keep)
    pad = UPSCALE * 2
    x0, y0 = max(xs.min() - pad, 0), max(ys.min() - pad, 0)
    x1, y1 = min(xs.max() + pad, keep.shape[1]), min(ys.max() + pad, keep.shape[0])
    keep = keep[y0:y1, x0:x1]

    scale = OUT_HEIGHT / keep.shape[0]
    width = max(8, int(round(keep.shape[1] * scale)))
    polys = curves_to_polygons(trace(keep), scale)

    # Silhueta nítida (polígonos com regra par/ímpar para manter os vazados).
    silhouette = Image.new("L", (width, OUT_HEIGHT), 0)
    draw = ImageDraw.Draw(silhouette)
    layers = np.zeros((OUT_HEIGHT, width), dtype=np.uint8)
    for poly in polys:
        if len(poly) < 3:
            continue
        tmp = Image.new("1", (width, OUT_HEIGHT), 0)
        ImageDraw.Draw(tmp).polygon(poly, fill=1)
        layers ^= np.asarray(tmp, dtype=np.uint8)
    silhouette = Image.fromarray(layers * 255, "L").filter(ImageFilter.GaussianBlur(1.2))
    alpha = np.asarray(silhouette, dtype=np.float32) / 255.0
    del draw

    # Ponto cetim: estrias finas diagonais moduladas no branco do fio da foto.
    yy, xx = np.mgrid[0:OUT_HEIGHT, 0:width].astype(np.float32)
    stripes = 0.5 + 0.5 * np.sin((xx * 0.7 + yy) * (2 * np.pi / 9.0))
    thread = np.array([238, 236, 231], dtype=np.float32)
    shade = (0.86 + 0.14 * stripes)[..., None]
    color = np.clip(thread * shade, 0, 255)
    rgba = np.dstack([color, alpha * 255]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(out_dir / f"{name}.png", optimize=True)

    body = cv2.GaussianBlur(alpha, (0, 0), 10)
    height = np.clip((0.7 * body + 0.3 * stripes * alpha) * alpha, 0, 1)
    Image.fromarray((height * 255).astype(np.uint8), "L").save(out_dir / f"{name}-height.png", optimize=True)

    meta = {
        "source": file,
        "crop": list(crop),
        "size": [width, OUT_HEIGHT],
        "aspect": round(width / OUT_HEIGHT, 4),
        "note": "Contorno traçado dos pixels da foto; foto de origem em baixa resolução.",
    }
    (out_dir / f"{name}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def main(src: str, out: str) -> None:
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name in SOURCES:
        print(name, render(name, Path(src), out_dir))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("uso: extract-polo-embroidery.py <pasta-fotos> <pasta-saida>")
    main(sys.argv[1], sys.argv[2])
