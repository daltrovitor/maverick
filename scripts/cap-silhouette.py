# Hello World
"""Compara a silhueta do boné em duas capturas (foto real × render 3D) no mesmo quadro.

Uso: python -I scripts/cap-silhouette.py <foto.png> <render.png> [x0 y0 x1 y1]
Mede, dentro da região informada (padrão: quadro inteiro): caixa delimitadora do boné,
largura por altura relativa e a caixa do bordado vermelho. Imprime as diferenças.
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image


def measure(path: str, box: tuple[int, int, int, int] | None):
    img = Image.open(path).convert("RGB")
    if box:
        img = img.crop(box)
    a = np.asarray(img).astype(int)
    dark = a.max(axis=2) < 110  # tecido preto (o fundo é branco/creme)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 140) & (g < 100) & (b < 110)
    ys, xs = np.nonzero(dark)
    if len(xs) == 0:
        return None
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
    h = y1 - y0
    rows = {}
    for f in (0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95):
        y = int(y0 + f * h)
        cols = np.nonzero(dark[y])[0]
        rows[f] = (cols.min() - x0, cols.max() - x0) if len(cols) else None
    rys, rxs = np.nonzero(red)
    redbox = (rxs.min() - x0, rys.min() - y0, rxs.max() - x0, rys.max() - y0) if len(rxs) else None
    return {"bbox": (x0, y0, x1, y1), "w": x1 - x0, "h": h, "rows": rows, "red": redbox}


def main() -> None:
    photo, render = sys.argv[1], sys.argv[2]
    box = tuple(int(v) for v in sys.argv[3:7]) if len(sys.argv) >= 7 else None
    a, b = measure(photo, box), measure(render, box)
    if not a or not b:
        raise SystemExit("silhueta não encontrada")
    for name, m in (("foto", a), ("3d", b)):
        print(name, "bbox", m["bbox"], "w", m["w"], "h", m["h"], "h/w %.3f" % (m["h"] / m["w"]))
    print("escala 3d/foto (largura): %.3f" % (b["w"] / a["w"]))
    print("deslocamento centro: dx=%d dy=%d" % ((b["bbox"][0] + b["bbox"][2] - a["bbox"][0] - a["bbox"][2]) / 2, (b["bbox"][1] + b["bbox"][3] - a["bbox"][1] - a["bbox"][3]) / 2))
    for f in a["rows"]:
        ra, rb = a["rows"][f], b["rows"][f]
        print("altura %.2f  foto %s  3d %s" % (f, ra and (round(ra[0] / a["w"], 3), round(ra[1] / a["w"], 3)), rb and (round(rb[0] / b["w"], 3), round(rb[1] / b["w"], 3))))
    if a["red"] and b["red"]:
        na = [round(v / a["w"], 3) for v in a["red"]]
        nb = [round(v / b["w"], 3) for v in b["red"]]
        print("bordado (x0,y0,x1,y1 / largura)  foto", na, " 3d", nb)


if __name__ == "__main__":
    main()
