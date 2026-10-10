// Hello World
/**
 * Geometria procedural do boné principal: dad hat Polo de seis gomos, calibrada pelas fotos
 * de frente, laterais e traseira.
 *
 * Copa = superfície paramétrica P(u, v):
 *  - u ∈ [0, 1) dá a volta na copa; u = 0 é o centro da nuca e u = 0.5 a testa;
 *  - v ∈ [0, 1] sobe da borda (0) até o botão (1).
 * Todas as variações ao redor da copa usam funções suaves (sem quinas), para não surgirem
 * calombos entre frente e laterais. A borda inferior da copa e a borda interna da aba usam a
 * MESMA função de altura: aba, copa e pespontos ficam sempre colados.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Path,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";

export const CAP = {
  /** Meia-largura e meio-comprimento da borda da copa. */
  radiusX: 1.0,
  radiusZ: 1.12,
  /** Altura do botão sobre a borda. */
  height: 0.67,
  /** Frente mais alta e traseira mais baixa ao longo dos gomos (fração da altura). */
  frontRise: 0.1,
  /** Ápice (botão) levemente atrás do centro, como no perfil lateral das fotos. */
  apexZ: -0.04,
  /** Perfil dos gomos: expoente menor = gomo mais "cheio" (frente mais em pé). */
  fullnessBack: 1.0,
  fullnessFront: 0.82,
  /** Aba: curvatura lateral (y = −k·x²), caimento para a frente, extensão e espessura. */
  brimBend: 0.4,
  brimSlope: 0.16,
  brimHalfAngle: 1.02,
  brimLength: 0.66,
  brimThickness: 0.032,
  /** Abertura traseira (arco elíptico). */
  archHalfAngle: 0.42,
  archHeight: 0.44,
} as const;

const TAU = Math.PI * 2;
const FRONT_ANGLE = Math.PI / 2;

export function angleOf(u: number): number {
  return 1.5 * Math.PI + TAU * u;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Distância angular (0..π) até a testa. */
function distanceFromFront(a: number): number {
  const d = Math.abs((((a - FRONT_ANGLE) % TAU) + TAU) % TAU);
  return d > Math.PI ? TAU - d : d;
}

/** 1 sobre toda a largura da aba, decaindo suavemente fora dela. */
function brimMask(a: number): number {
  return 1 - smoothstep(CAP.brimHalfAngle, CAP.brimHalfAngle + 0.45, distanceFromFront(a));
}

/** Altura da borda da copa: acompanha a curvatura da aba na frente. */
export function rimHeight(x: number, a: number): number {
  return -CAP.brimBend * x * x * brimMask(a);
}

function rimXZ(a: number): { x: number; z: number } {
  return { x: CAP.radiusX * Math.cos(a), z: CAP.radiusZ * Math.sin(a) };
}

export function crownPoint(u: number, v: number, target = new Vector3()): Vector3 {
  const a = angleOf(u);
  const e = Math.min(1, Math.max(0, v)) * (Math.PI / 2);
  // 1 na frente, 0 na nuca — variação suave (cosseno), sem quinas nas laterais.
  const f = (1 + Math.sin(a)) / 2;
  const k = CAP.fullnessBack + (CAP.fullnessFront - CAP.fullnessBack) * f;
  const cosE = Math.max(0, Math.cos(e));
  const radial = Math.pow(cosE, k);
  const lift = Math.sin(e);
  const rim = rimXZ(a);
  const x = rim.x * radial;
  const z = CAP.apexZ + (rim.z - CAP.apexZ) * radial;
  const rimY = rimHeight(rim.x, a);
  const rise = 1 + CAP.frontRise * (2 * f - 1) * cosE;
  const y = rimY * (1 - lift) * (1 - lift) + CAP.height * lift * rise;
  return target.set(x, y, z);
}

const CROWN_CENTER = new Vector3(0, CAP.height * 0.32, CAP.apexZ * 0.5);

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

/** Arco traseiro elíptico (abertura do ajuste). */
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

/** Malha regular sobre a copa (copa, forro, faixas e bordados). */
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

export function buildCrownGeometry(offset = 0, segmentsU = 192, segmentsV = 72): BufferGeometry {
  return buildCrownPatch({ u0: 0, u1: 1, v0: 0, v1: 1, segmentsU, segmentsV, offset, cutArch: true, flipU: false });
}

/** Faixa (ribbon) que acompanha a copa entre duas alturas. */
export function buildBand(u0: number, u1: number, v0: number, v1: number, offset: number, segments = 96): BufferGeometry {
  return buildCrownPatch({ u0, u1, v0, v1, segmentsU: segments, segmentsV: 3, offset, cutArch: false, flipU: true });
}

/** Costuras entre os 6 gomos (inclui a central da testa e a da nuca acima do arco). */
export const SEAM_US: readonly number[] = [0.5, 0.5 + 1 / 6, 0.5 + 2 / 6, 1, 1 / 6, 2 / 6];

export function seamPoints(u: number, side = 0, offset = 0.004, samples = 64): Vector3[] {
  const wrapped = ((u % 1) + 1) % 1;
  const atBack = wrapped < 1e-6 || wrapped > 1 - 1e-6;
  const startV = atBack ? CAP.archHeight + 0.012 : 0.006;
  const points: Vector3[] = [];
  for (let k = 0; k <= samples; k += 1) {
    const v = startV + ((0.975 - startV) * k) / samples;
    points.push(crownOffsetPoint(wrapped + side, v, offset));
  }
  return points;
}

export function buildSeamTube(u: number): TubeGeometry {
  const curve = new CatmullRomCurve3(seamPoints(u, 0, 0.0035, 80));
  return new TubeGeometry(curve, 96, 0.0058, 6, false);
}

/** Debrum que contorna o arco traseiro. */
export function buildArchBindingTube(): TubeGeometry {
  const points: Vector3[] = [];
  const samples = 72;
  for (let k = 0; k <= samples; k += 1) {
    const theta = -Math.PI / 2 + (Math.PI * k) / samples;
    const d = Math.sin(theta) * CAP.archHalfAngle;
    const v = Math.max(0.004, CAP.archHeight * Math.cos(theta));
    const u = d / TAU;
    points.push(crownOffsetPoint(u < 0 ? 1 + u : u, v, 0.002));
  }
  return new TubeGeometry(new CatmullRomCurve3(points), 120, 0.016, 8, false);
}

/* ───────────────────────── Aba ───────────────────────── */

/** Normal (no plano XZ) da elipse da borda, apontando para fora. */
function rimOutward(a: number): { nx: number; nz: number } {
  let nx = Math.cos(a) / CAP.radiusX;
  let nz = Math.sin(a) / CAP.radiusZ;
  const len = Math.hypot(nx, nz);
  nx /= len;
  nz /= len;
  return { nx, nz };
}

/** Extensão da aba em cada ponto da borda: máxima na frente, zero nas pontas. */
function brimReach(s: number): number {
  return CAP.brimLength * Math.pow(Math.max(0, 1 - s * s), 0.62);
}

/**
 * Ponto da superfície superior da aba. s ∈ [-1, 1] percorre a largura (laterais → frente →
 * laterais); w ∈ [0, 1] vai da costura com a copa até a borda.
 */
export function brimPoint(s: number, w: number, target = new Vector3()): Vector3 {
  const a = FRONT_ANGLE + s * CAP.brimHalfAngle;
  const rim = rimXZ(a);
  const { nx, nz } = rimOutward(a);
  const reach = brimReach(s) * w;
  const x = rim.x + nx * reach;
  const z = rim.z + nz * reach;
  const y = -CAP.brimBend * x * x - CAP.brimSlope * reach;
  return target.set(x, y, z);
}

/** Mantida para testes/compatibilidade: altura da aba num ponto (x, z) da borda. */
export function brimDrop(x: number, reach = 0): number {
  return -CAP.brimBend * x * x - CAP.brimSlope * reach;
}

function brimNormal(s: number, w: number): Vector3 {
  const h = 1e-3;
  const ps = brimPoint(Math.min(1, s + h), w).sub(brimPoint(Math.max(-1, s - h), w));
  const pw = brimPoint(s, Math.min(1, w + h)).sub(brimPoint(s, Math.max(0, w - h)));
  const n = new Vector3().crossVectors(ps, pw).normalize();
  if (n.y < 0) n.negate();
  return n;
}

/**
 * Aba como malha densa contínua e fechada: face superior, inferior e borda arredondada.
 * Densa o bastante para a curvatura não facetar em close.
 */
export function buildBrimGeometry(segmentsS = 120, segmentsW = 24): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const t = CAP.brimThickness;
  const top: number[][] = [];
  const bottom: number[][] = [];
  const point = new Vector3();
  let index = 0;

  const push = (p: Vector3) => {
    positions.push(p.x, p.y, p.z);
    return index++;
  };

  for (let i = 0; i <= segmentsS; i += 1) {
    const s = -1 + (2 * i) / segmentsS;
    const rowTop: number[] = [];
    const rowBottom: number[] = [];
    for (let j = 0; j <= segmentsW; j += 1) {
      const w = j / segmentsW;
      brimPoint(s, w, point);
      const n = brimNormal(s, w);
      // A espessura afina um pouco rumo à borda (acabamento da aba).
      const thick = t * (1 - 0.25 * w);
      rowTop.push(push(point.clone().addScaledVector(n, thick * 0.5)));
      rowBottom.push(push(point.clone().addScaledVector(n, -thick * 0.5)));
    }
    top.push(rowTop);
    bottom.push(rowBottom);
  }

  for (let i = 0; i < segmentsS; i += 1) {
    for (let j = 0; j < segmentsW; j += 1) {
      const a = top[i]![j]!;
      const b = top[i + 1]![j]!;
      const c = top[i + 1]![j + 1]!;
      const d = top[i]![j + 1]!;
      indices.push(a, d, b, b, d, c);
      const a2 = bottom[i]![j]!;
      const b2 = bottom[i + 1]![j]!;
      const c2 = bottom[i + 1]![j + 1]!;
      const d2 = bottom[i]![j + 1]!;
      indices.push(a2, b2, d2, b2, c2, d2);
    }
    // Borda externa (fecha topo e base).
    const tA = top[i]![segmentsW]!;
    const tB = top[i + 1]![segmentsW]!;
    const bA = bottom[i]![segmentsW]!;
    const bB = bottom[i + 1]![segmentsW]!;
    indices.push(tA, tB, bA, tB, bB, bA);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Fileiras de pesponto sobre a aba (na mesma superfície da malha). */
export function brimStitchRows(rows = 8, lift = 0.0005): Vector3[][] {
  const result: Vector3[][] = [];
  for (let k = 0; k < rows; k += 1) {
    const w = 0.14 + (0.8 * k) / Math.max(1, rows - 1);
    const row: Vector3[] = [];
    const samples = 160;
    for (let i = 0; i <= samples; i += 1) {
      const s = -0.96 + (1.92 * i) / samples;
      if (brimReach(s) * w < 0.03) continue;
      const p = brimPoint(s, w);
      const n = brimNormal(s, w);
      row.push(p.addScaledVector(n, CAP.brimThickness * 0.5 * (1 - 0.25 * w) + lift));
    }
    if (row.length > 2) result.push(row);
  }
  return result;
}

/** Normal da aba no ponto de uma fileira (para deitar o fio). */
export function brimSurfaceNormal(): Vector3 {
  return new Vector3(0, 1, 0);
}

/** Ponto central da aba (para âncoras). */
export function brimCenter(): Vector3 {
  const p = brimPoint(0, 0.55);
  return p.add(new Vector3(0, CAP.brimThickness * 0.5, 0));
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

export function buildBuckleGeometry(width = 0.17, height = 0.13, bar = 0.026): BufferGeometry {
  const outer = new Shape();
  roundedRect(outer, width, height, Math.min(width, height) * 0.14);
  const hole = new Path();
  roundedRect(hole, width - bar * 2, height - bar * 2, Math.min(width, height) * 0.06);
  outer.holes.push(hole);
  const geometry = new ExtrudeGeometry(outer, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -0.007);
  return geometry;
}

/** Barra central da fivela (regulador). */
export function buildBucklePinGeometry(length = 0.09): BufferGeometry {
  const shape = new Shape();
  roundedRect(shape, 0.012, length, 0.004);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
  geometry.translate(0, 0, 0.002);
  return geometry;
}
