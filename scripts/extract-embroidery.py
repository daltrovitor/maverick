# Hello World
"""Recorta o bordado real da foto do boné principal e gera texturas para o modelo 3D.

Uso: python -I scripts/extract-embroidery.py brand-assets/source/cap-red-sox-b-front.png public/models/red-sox-b

Gera (mesmo enquadramento):
  - embroidery.png         cor do bordado com transparência (o tecido preto vira alfa 0)
  - embroidery-height.png  mapa de relevo em tons de cinza (puff mais alto no centro dos traços)
  - embroidery.json        enquadramento do recorte na foto (para posicionar no modelo)
Nada é redesenhado: as cores e o traçado vêm dos pixels da fotografia fornecida.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

# Região do bordado na foto original (com margem); medida pelos pixels vermelhos (265..400 × 125..300).
CROP = (250, 110, 416, 316)
UPSCALE = 4
FABRIC_LEVEL = 48.0  # brilho máximo típico do tecido preto na região
RAMP = 60.0


def main(src: str, out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    photo = Image.open(src).convert("RGB")
    crop = photo.crop(CROP)
    big = crop.resize((crop.width * UPSCALE, crop.height * UPSCALE), Image.Resampling.LANCZOS)
    rgb = np.asarray(big, dtype=np.float32)

    # Alfa: quanto o pixel se afasta do tecido escuro (bordado é vermelho saturado ou branco).
    peak = rgb.max(axis=2)
    alpha = np.clip((peak - FABRIC_LEVEL) / RAMP, 0.0, 1.0)
    alpha_img = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(alpha_img, dtype=np.float32) / 255.0

    # Remove respingos (pontos da costura central captados no recorte): mantém só as
    # regiões conectadas grandes, que formam a letra bordada.
    binary = (alpha > 0.35).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    keep = np.zeros_like(binary)
    min_area = 0.02 * binary.sum()
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= min_area:
            keep[labels == label] = 1
    keep = cv2.dilate(keep, np.ones((5, 5), np.uint8))
    alpha = alpha * keep

    # Cor: remove a contaminação do preto nas bordas (despremultiplica pelo alfa).
    safe = np.maximum(alpha[..., None], 0.08)
    color = np.clip(rgb / safe, 0, 255) * (alpha[..., None] > 0.02)
    rgba = np.dstack([color, alpha * 255]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(out / "embroidery.png", optimize=True)

    # Relevo: distância às bordas aproximada por desfoque do alfa (puff arredondado) +
    # a textura de luminância do próprio ponto cetim.
    soft = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(9))
    body = np.asarray(soft, dtype=np.float32) / 255.0
    lum = rgb.mean(axis=2) / 255.0
    height = np.clip(0.75 * body * alpha + 0.25 * lum * alpha, 0, 1)
    Image.fromarray((height * 255).astype(np.uint8), "L").save(out / "embroidery-height.png", optimize=True)

    meta = {
        "source": Path(src).name,
        "photoSize": [photo.width, photo.height],
        "crop": list(CROP),
        "textureSize": [big.width, big.height],
        "aspect": round(big.width / big.height, 4),
    }
    (out / "embroidery.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("ok", meta)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("uso: extract-embroidery.py <foto.png> <pasta-saida>")
    main(sys.argv[1], sys.argv[2])
