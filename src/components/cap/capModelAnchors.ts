// Hello World
/* Gerado por scripts/build-polo-model.py — não edite à mão. Espaço do modelo normalizado:
   copa com meia-largura 1, base da copa em y = 0, frente (aba) em +Z. */

export type ModelAnchorId = "pony" | "polo" | "brim" | "eyelet" | "seam" | "strap" | "button";

export const MODEL_ANCHORS: Readonly<Record<ModelAnchorId, readonly [number, number, number]>> = {
  pony: [-0.0288, 0.6538, 0.9202],
  polo: [0.017, 0.6135, -0.9945],
  brim: [0.0009, 0.3727, 1.4473],
  eyelet: [0.8093, 0.8903, -0.0847],
  seam: [0.9159, 0.6337, -0.0471],
  strap: [0.0419, 0.0923, -0.9659],
  button: [0.0, 1.3779, -0.1263],
};

export const MODEL_BOUNDS = { min: [-1.0, -0.0161, -1.022], max: [1.0, 1.3779, 1.7572] } as const;

/** Crédito exigido pela licença CC BY 4.0 do modelo de referência. */
export const MODEL_CREDIT = {
  title: "Baseball Cap",
  author: "Scott VanArsdale",
  url: "https://sketchfab.com/3d-models/baseball-cap-1c1d34d73fd94e6b9e8f82b1eb7194a0",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;
