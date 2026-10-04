// Hello World
/**
 * Geometria vetorial das marcas da parceria.
 * Fonte única para SVG (React) e Canvas 2D (textura do bordado no visualizador 3D).
 */

/* ───────────── Maverick: M serifado romano + garanhão em espaço negativo ───────────── */

export const MAVERICK_VIEWBOX = "18 -2 216 186";
export const MAVERICK_VIEWBOX_RECT = { x: 18, y: -2, width: 216, height: 186 } as const;

/** Hastes, diagonais e serifas do M (traço fino à esquerda, grosso na diagonal e na haste direita). */
export const MAVERICK_M_PATHS: readonly string[] = [
  "M36 173 L46 27 L78 27 L128 152 L188 27 L213 27 L215 173 L190 173 L189 45 L124 180 L54.4 36.1 L45 173 Z",
  "M24 176 L58 176 L58 173 C52 172 47 168 45 160 L36 160 C34 168 29 172 24 173 Z",
  "M178 176 L227 176 L227 173 C221 172 216 168 215 160 L190 160 C189 168 184 172 178 173 Z",
  "M34 27 L80 27 L80 24 L34 24 Z",
  "M180 24 L225 24 L225 27 C220 28 215 31 213 36 L188 36 C186 31 184 28 180 27 Z",
];

/** Transformação da cabeça do cavalo (desenhada em coordenadas locais) para o espaço do M. */
export const HORSE_TRANSFORM = { x: 94, y: 1, scale: 0.56 } as const;

/** Cabeça + crina esvoaçante, em coordenadas locais (perfil voltado à esquerda). */
export const HORSE_HEAD_PATHS: readonly string[] = [
  "M60 0 C58 8 55 16 53 22 C49 26 45 30 42 34 C32 50 18 70 8 86 C3 93 1 99 4 104 C6 108 10 110 14 110 C17 112 19 115 23 116 C28 117 33 114 36 110 C44 108 54 108 62 102 C70 96 73 86 70 78 C76 92 82 112 84 140 L114 140 C112 110 106 80 92 52 C86 40 78 28 72 20 C72 12 71 6 70 2 C67 6 64 12 63 14 C62 10 61 5 60 0 Z",
  "M66 22 C88 8 106 4 126 6 C112 14 98 26 84 42 Z",
  "M80 38 C102 24 120 20 140 24 C124 32 110 44 94 60 Z",
  "M90 56 C112 44 130 42 150 48 C134 54 120 64 102 82 Z",
  "M98 78 C116 70 130 72 142 80 C130 84 118 92 106 104 Z",
  "M102 102 C112 100 120 104 126 112 C118 114 112 120 108 128 Z",
];

/** Pescoço que desce até o vértice do M (já em coordenadas do M). */
export const HORSE_NECK_PATH = "M141 79 C138 96 127 110 125 122 L128.5 137 L136 122 C141 108 152 96 158 79 Z";

/** Detalhes em linha (ganacha e narina), em coordenadas locais. */
export const HORSE_DETAIL_PATHS: readonly string[] = ["M47 70 C58 72 66 82 64 96", "M9 95 C11 92 14 93 13 97"];

export const HORSE_EYE = { cx: 119.5, cy: 27, rx: 2.4, ry: 1.4, rotate: -35 } as const;

/** Espessura do recorte (halo) que separa o cavalo das hastes do M. */
export const HORSE_HALO_WIDTH = 5;

export const HORSE_TRANSFORM_ATTR = `translate(${HORSE_TRANSFORM.x} ${HORSE_TRANSFORM.y}) scale(${HORSE_TRANSFORM.scale})`;

/* ───────────── ViraWeb: 13 polígonos triangulares oficiais ───────────── */

export const VIRAWEB_VIEWBOX = "0 0 766 621";

export interface VirawebPolygon {
  readonly points: string;
  readonly fill: string;
}

export const VIRAWEB_POLYGONS: readonly VirawebPolygon[] = [
  { points: "2,93.5 84.7,239.5 223.5,92.5", fill: "#132a46" },
  { points: "307,243.5 223.5,92.5 84.7,239.5", fill: "#113f73" },
  { points: "84.7,239.5 200.5,446 307,243.5", fill: "#2965ae" },
  {
    points: "307,243.5 200.5,446 245,527.5 184,527.5 299,616.5 415,525.5 352,524 386.7,465.5 409,421.5",
    fill: "#132a46",
  },
  { points: "489,286.5 409,421.5 386.7,465.5 474,465 529,377", fill: "#f2bf12" },
  { points: "386.7,465.5 430.5,534 474,465", fill: "#e4a009" },
  { points: "529,377 474,465 568.3,465.2", fill: "#edb00e" },
  { points: "386.7,465.5 352,524 415,525.5 299,616.5 480.5,619 430.5,534", fill: "#edb00e" },
  { points: "568.3,465.2 474,465 430.5,534 480.5,619", fill: "#e39907" },
  { points: "585.5,286.2 489,286.5 529,377", fill: "#3aa7d4" },
  { points: "585.5,286.2 529,377 568.3,465.2 637,344", fill: "#246ba6" },
  { points: "763,2 493,99.5 567,151.5 489,286.5 585.5,286.2", fill: "#266ca6" },
  { points: "763,2 585.5,286.2 637,344 696,242.5 764,291.5", fill: "#1958a5" },
];
