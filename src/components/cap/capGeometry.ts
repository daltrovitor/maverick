// Hello World
/**
 * Geometria procedural do boné principal da Maverick (dad hat de seis gomos).
 *
 * A copa é uma superfície paramétrica P(u, v):
 *  - u ∈ [0, 1) percorre a circunferência; u = 0 é o centro da nuca e u = 0.5 a testa;
 *  - v ∈ [0, 1] sobe da borda (0) até o botão (1).
 * A aba e o forro derivam da mesma função, então tudo se encaixa sem emendas.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector3,
} from "three";

export const CAP = {
  /* Proporções calibradas pela foto frontal do boné principal (dad hat de seis gomos). */
  radiusX: 1.0,
  radiusZ: 1.08,
  apexHeight: 0.68,
  frontBulge: 0.12,
  apexBack: 0.12,
  /** Curvatura lateral da aba pré-curvada (y = −k·x²). */
  brimBend: 0.62,
  /** Inclinação da aba para baixo conforme avança. */
  brimSlope: 0.1,
  brimHalfAngle: 0.9,
  brimWidth: 0.58,
  brimThickness: 0.026,
  brimBevel: 0.012,
  archHalfAngle: 0.42,
  archHeight: 0.24,
  /** Afunilamento da copa rumo ao botão (maior = topo mais estreito, como na foto). */
  crownTaper: 1.55,
  /** Quanto a frente fica mais "em pé" que as laterais (painel frontal do bordado). */
  frontUpright: 0.75,
} as const;

const TAU = Math.PI * 2;
const FRONT_ANGLE = Math.PI / 2;

export function angleOf(u: number): number {
  return 1.5 * Math.PI + TAU * u;
}

/** Distância angular (0..π) entre o ângulo a e a testa. */
function distanceFromFront(a: number): number {
  const d = Math.abs((((a - FRONT_ANGLE) % TAU) + TAU) % TAU);
  return d > Math.PI ? TAU - d : d;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 1 na região da aba, decaindo suavemente para 0 nas laterais. */
function frontMask(a: number): number {
  return 1 - smoothstep(CAP.brimHalfAngle, CAP.brimHalfAngle + 0.5, distanceFromFront(a));
}

/** Rebaixo da borda na frente para acompanhar a aba curvada. */
function rimDrop(x: number, a: number): number {
  return CAP.brimBend * x * x * frontMask(a);
}

export function crownPoint(u: number, v: number, target = new Vector3()): Vector3 {
  const a = angleOf(u);
  const e = Math.min(1, Math.max(0, v)) * (Math.PI / 2);
  const front = Math.max(0, Math.sin(a));
  const exponent = CAP.crownTaper - CAP.frontUpright * front;
  const cosE = Math.max(0, Math.cos(e));
  const r = Math.pow(cosE, exponent);
  const height = Math.sin(e) * (CAP.apexHeight + CAP.frontBulge * front * cosE);

  const x = CAP.radiusX * r * Math.cos(a);
  const z = CAP.radiusZ * r * Math.sin(a) - CAP.apexBack * Math.sin(e);
  const fade = (1 - v) * (1 - v);
  const y = height - rimDrop(x, a) * fade;
  return target.set(x, y, z);
}

const CROWN_CENTER = new Vector3(0, 0.3, 0);

/** Normal externa por diferenças finitas. */
export function crownNormal(u: number, v: number, target = new Vector3()): Vector3 {
  const vv = Math.min(0.995, Math.max(0.002, v));
  const h = 1e-3;
  const p = crownPoint(u, vv);
  const pu = crownPoint(u + h, vv).sub(crownPoint(u - h, vv));
  const pv = crownPoint(u, vv + h).sub(crownPoint(u, vv - h));
  target.crossVectors(pv, pu).normalize();
  if (target.dot(p.sub(CROWN_CENTER)) < 0) target.negate();
  return target;
}

/** Ponto da superfície deslocado ao longo da normal (positivo = para fora). */
export function crownOffsetPoint(u: number, v: number, offset: number, target = new Vector3()): Vector3 {
  const n = crownNormal(u, v);
  return crownPoint(u, v, target).addScaledVector(n, offset);
}

export function isInArch(u: number, v: number): boolean {
  const wrapped = ((u % 1) + 1) % 1;
  const d = Math.min(wrapped, 1 - wrapped) * TAU;
  if (d >= CAP.archHalfAngle) return false;
  const ratio = d / CAP.archHalfAngle;
  return v < CAP.archHeight * Math.sqrt(1 - ratio * ratio);
}

interface GridOptions {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  readonly segmentsU: number;
  readonly segmentsV: number;
  readonly offset: number;
  readonly cutArch: boolean;
  /** Inverte U para que texturas não fiquem espelhadas vistas de fora. */
  readonly flipU: boolean;
}

/** Malha regular sobre a copa (usada para copa, forro, bordado e etiqueta). */
export function buildCrownPatch(options: GridOptions): BufferGeometry {
  const { u0, u1, v0, v1, segmentsU, segmentsV, offset, cutArch, flipU } = options;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();

  for (let j = 0; j <= segmentsV; j += 1) {
    const v = v0 + ((v1 - v0) * j) / segmentsV;
    for (let i = 0; i <= segmentsU; i += 1) {
      const u = u0 + ((u1 - u0) * i) / segmentsU;
      if (offset === 0) crownPoint(u, v, point);
      else crownOffsetPoint(u, v, offset, point);
      positions.push(point.x, point.y, point.z);
      const s = i / segmentsU;
      uvs.push(flipU ? 1 - s : s, j / segmentsV);
    }
  }

  const row = segmentsU + 1;
  for (let j = 0; j < segmentsV; j += 1) {
    for (let i = 0; i < segmentsU; i += 1) {
      if (cutArch) {
        const uc = u0 + ((u1 - u0) * (i + 0.5)) / segmentsU;
        const vc = v0 + ((v1 - v0) * (j + 0.5)) / segmentsV;
        if (isInArch(uc, vc)) continue;
      }
      const a = j * row + i;
      const b = a + 1;
      const d = a + row;
      const c = d + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildCrownGeometry(offset = 0): BufferGeometry {
  return buildCrownPatch({
    u0: 0,
    u1: 1,
    v0: 0,
    v1: 1,
    segmentsU: 168,
    segmentsV: 60,
    offset,
    cutArch: true,
    flipU: false,
  });
}

/** Faixa (ribbon) que acompanha a copa entre duas alturas. */
export function buildBand(u0: number, u1: number, v0: number, v1: number, offset: number, segments = 96): BufferGeometry {
  return buildCrownPatch({ u0, u1, v0, v1, segmentsU: segments, segmentsV: 2, offset, cutArch: false, flipU: true });
}

/** Costuras entre os 6 gomos (inclui a costura central da testa e a da nuca acima do recorte). */
export const SEAM_US: readonly number[] = [0.5, 0.5 + 1 / 6, 0.5 + 2 / 6, 1, 1 / 6, 2 / 6];

export function seamPoints(u: number, side = 0, offset = 0.004, samples = 48): Vector3[] {
  const wrapped = ((u % 1) + 1) % 1;
  const startV = wrapped < 1e-6 || wrapped > 1 - 1e-6 ? CAP.archHeight + 0.01 : 0.004;
  const points: Vector3[] = [];
  for (let k = 0; k <= samples; k += 1) {
    const v = startV + ((0.985 - startV) * k) / samples;
    points.push(crownOffsetPoint(wrapped + side, v, offset));
  }
  return points;
}

export function buildSeamTube(u: number): TubeGeometry {
  const curve = new CatmullRomCurve3(seamPoints(u));
  return new TubeGeometry(curve, 64, 0.0055, 6, false);
}

export function buildArchBindingTube(): TubeGeometry {
  const points: Vector3[] = [];
  const samples = 56;
  for (let k = 0; k <= samples; k += 1) {
    const theta = -Math.PI / 2 + (Math.PI * k) / samples;
    const t = Math.sin(theta);
    const d = t * CAP.archHalfAngle;
    const v = Math.max(0.002, CAP.archHeight * Math.cos(theta));
    const u = d / TAU;
    points.push(crownOffsetPoint(u < 0 ? 1 + u : u, v, 0.003));
  }
  return new TubeGeometry(new CatmullRomCurve3(points), 96, 0.014, 8, false);
}

/* ───────────────────────── Aba ───────────────────────── */

function rimXZ(a: number): { x: number; z: number; nx: number; nz: number } {
  const x = CAP.radiusX * Math.cos(a);
  const z = CAP.radiusZ * Math.sin(a);
  let nx = Math.cos(a) / CAP.radiusX;
  let nz = Math.sin(a) / CAP.radiusZ;
  const len = Math.hypot(nx, nz);
  nx /= len;
  nz /= len;
  return { x, z, nx, nz };
}

function brimWidthAt(a: number): number {
  const ratio = (a - FRONT_ANGLE) / CAP.brimHalfAngle;
  return CAP.brimWidth * Math.pow(Math.max(0, 1 - ratio * ratio), 0.55);
}

/** Deslocamento vertical da aba: curvatura lateral + caimento frontal. */
export function brimDrop(x: number, z: number): number {
  const t = Math.max(0, Math.hypot(x / CAP.radiusX, z / CAP.radiusZ) - 1);
  return -CAP.brimBend * x * x - CAP.brimSlope * t;
}

function brimShape(): Shape {
  const shape = new Shape();
  const samples = 72;
  for (let k = 0; k <= samples; k += 1) {
    const a = FRONT_ANGLE - CAP.brimHalfAngle + (2 * CAP.brimHalfAngle * k) / samples;
    const { x, z } = rimXZ(a);
    if (k === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  for (let k = samples; k >= 0; k -= 1) {
    const a = FRONT_ANGLE - CAP.brimHalfAngle + (2 * CAP.brimHalfAngle * k) / samples;
    const { x, z, nx, nz } = rimXZ(a);
    const w = brimWidthAt(a);
    shape.lineTo(x + nx * w, z + nz * w);
  }
  shape.closePath();
  return shape;
}

function applyBrimBend(geometry: BufferGeometry): void {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, position.getY(i) + brimDrop(x, z));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function buildBrimGeometry(): BufferGeometry {
  const geometry = new ExtrudeGeometry(brimShape(), {
    depth: CAP.brimThickness,
    bevelEnabled: true,
    bevelThickness: CAP.brimBevel,
    bevelSize: CAP.brimBevel * 0.8,
    bevelSegments: 2,
    curveSegments: 4,
  });
  // Extrusão em +Z → após girar 90° em X a aba fica no plano XZ, com espessura para baixo.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, CAP.brimBevel * 0.2, 0);
  applyBrimBend(geometry);
  return geometry;
}

export function buildUnderbrimGeometry(): BufferGeometry {
  const geometry = new ShapeGeometry(brimShape(), 4);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, -(CAP.brimThickness + CAP.brimBevel + 0.004), 0);
  applyBrimBend(geometry);
  return geometry;
}

/** Linhas de pesponto concêntricas sobre a aba. */
export function brimStitchRows(rows = 8, spacing = 0.05): Vector3[][] {
  const result: Vector3[][] = [];
  const topY = CAP.brimBevel * 1.2 + 0.002;
  for (let k = 1; k <= rows; k += 1) {
    const inset = spacing * k;
    const row: Vector3[] = [];
    const samples = 90;
    for (let s = 0; s <= samples; s += 1) {
      const a = FRONT_ANGLE - CAP.brimHalfAngle + (2 * CAP.brimHalfAngle * s) / samples;
      const distance = brimWidthAt(a) - inset;
      if (distance < 0.035) continue;
      const { x, z, nx, nz } = rimXZ(a);
      const px = x + nx * distance;
      const pz = z + nz * distance;
      row.push(new Vector3(px, topY + brimDrop(px, pz), pz));
    }
    if (row.length > 2) result.push(row);
  }
  return result;
}

/** Ponto central da aba (para âncoras e explosão). */
export function brimCenter(): Vector3 {
  const { x, z, nx, nz } = rimXZ(FRONT_ANGLE);
  const w = CAP.brimWidth * 0.55;
  const px = x + nx * w;
  const pz = z + nz * w;
  return new Vector3(px, brimDrop(px, pz), pz);
}

/* ───────────────────────── Fivela ───────────────────────── */

function roundedRect(path: Path | Shape, width: number, height: number, radius: number): void {
  const x = -width / 2;
  const y = -height / 2;
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
}

export function buildBuckleGeometry(): BufferGeometry {
  const outer = new Shape();
  roundedRect(outer, 0.17, 0.13, 0.025);
  const hole = new Path();
  roundedRect(hole, 0.11, 0.07, 0.012);
  outer.holes.push(hole);
  const geometry = new ExtrudeGeometry(outer, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -0.008);
  return geometry;
}

/** Barra central (pino) da fivela. */
export function buildBucklePinGeometry(): BufferGeometry {
  const shape = new Shape();
  roundedRect(shape, 0.012, 0.09, 0.004);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false });
  geometry.translate(0, 0, 0.004);
  return geometry;
}
