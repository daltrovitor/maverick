# Hello World
"""Vetoriza o logo oficial da Maverick (raster creme/café) em SVGs limpos.

Uso: python -I scripts/vectorize-logo.py brand-assets/source/maverick-logo.png public/brand

Gera:
  - maverick-logo.svg       (logo completo: monograma, wordmark, subtítulo e EST. 2026)
  - maverick-monogram.svg   (apenas o "M" com o cavalo)
  - maverick-logo@2x.png    (raster transparente de alta resolução, fallback)
As cores e proporções originais são preservadas; o fundo creme vira transparência.
"""
from __future__ import annotations

import sys
from html import escape
from pathlib import Path

import numpy as np
import potrace
from PIL import Image

INK = "#26170A"  # mediana dos pixels escuros do arquivo oficial
BG = np.array([250, 246, 235], dtype=np.float32)  # creme do arquivo oficial
UPSCALE = 6


def ink_alpha(img: Image.Image) -> np.ndarray:
    """Alpha 0..1 proporcional à distância do pixel ao creme de fundo."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    ink = np.array([38, 23, 8], dtype=np.float32)
    span = np.linalg.norm(BG - ink)
    dist = np.linalg.norm(rgb - BG, axis=2)
    return np.clip(dist / span, 0.0, 1.0)


def trace(mask: np.ndarray) -> list[str]:
    # potracer trata False como "tinta": invertemos para traçar apenas o logo.
    bitmap = potrace.Bitmap(~mask)
    curves = bitmap.trace(turdsize=3, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.2)
    paths: list[str] = []
    for curve in curves:
        start = curve.start_point
        parts = [f"M{start.x:.2f},{start.y:.2f}"]
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f"L{seg.c.x:.2f},{seg.c.y:.2f}L{seg.end_point.x:.2f},{seg.end_point.y:.2f}")
            else:
                parts.append(
                    f"C{seg.c1.x:.2f},{seg.c1.y:.2f} {seg.c2.x:.2f},{seg.c2.y:.2f} {seg.end_point.x:.2f},{seg.end_point.y:.2f}"
                )
        parts.append("Z")
        paths.append("".join(parts))
    return paths


def write_svg(path: Path, d_list: list[str], box: tuple[int, int, int, int], title: str) -> None:
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d = "".join(d_list)
    title = escape(title, quote=True)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {w} {h}" role="img" aria-label="{title}">'
        f"<title>{title}</title>"
        f'<path fill="{INK}" fill-rule="evenodd" d="{d}"/></svg>\n'
    )
    path.write_text(svg, encoding="utf-8")


def bbox(mask: np.ndarray, pad: int) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    return (
        max(int(xs.min()) - pad, 0),
        max(int(ys.min()) - pad, 0),
        min(int(xs.max()) + pad, mask.shape[1]),
        min(int(ys.max()) + pad, mask.shape[0]),
    )


def main(src: str, out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    original = Image.open(src)
    big = original.convert("RGB").resize(
        (original.width * UPSCALE, original.height * UPSCALE), Image.Resampling.LANCZOS
    )
    alpha = ink_alpha(big)
    mask = alpha > 0.42

    # O ponto de "EST." é um pixel claro demais para o limiar; reforçamos no lugar exato do original.
    yy, xx = np.ogrid[: mask.shape[0], : mask.shape[1]]
    dot_x, dot_y, dot_r = 251.6 * UPSCALE, 254.6 * UPSCALE, 1.15 * UPSCALE
    mask |= (xx - dot_x) ** 2 + (yy - dot_y) ** 2 <= dot_r**2

    # Logo completo
    write_svg(out / "maverick-logo.svg", trace(mask), bbox(mask, 6 * UPSCALE), "Maverick Headwear & Lifestyle")

    # Monograma: faixa superior (linhas 57–161 no arquivo original)
    mono = np.zeros_like(mask)
    top, bottom = 50 * UPSCALE, 166 * UPSCALE
    mono[top:bottom, :] = mask[top:bottom, :]
    write_svg(out / "maverick-monogram.svg", trace(mono), bbox(mono, 4 * UPSCALE), "Maverick")

    # Raster transparente (fallback / OG)
    rgba = np.zeros((big.height, big.width, 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 38, 23, 8
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    x0, y0, x1, y1 = bbox(mask, 6 * UPSCALE)
    Image.fromarray(rgba, "RGBA").crop((x0, y0, x1, y1)).resize(
        ((x1 - x0) // 3, (y1 - y0) // 3), Image.Resampling.LANCZOS
    ).save(out / "maverick-logo@2x.png", optimize=True)
    print("ok", out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("uso: vectorize-logo.py <logo.png> <pasta-saida>")
    main(sys.argv[1], sys.argv[2])
