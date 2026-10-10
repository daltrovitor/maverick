// Hello World
/**
 * Pespontos como geometria real: cada ponto de linha é uma instância alinhada à costura,
 * deitada sobre a superfície. Diferente de linhas de 1 px, continuam convincentes em close.
 */
import { Matrix4, Quaternion, Vector3 } from "three";

export interface StitchOptions {
  /** Distância entre pontos consecutivos (unidades do modelo). */
  readonly pitch: number;
  /** Comprimento de cada ponto. */
  readonly length: number;
  /** Largura (espessura do fio). */
  readonly width: number;
  /** Altura do ponto sobre o tecido. */
  readonly lift: number;
}

/**
 * Distribui pontos ao longo de uma polilinha. `normalAt` devolve a normal da superfície no
 * ponto (para que o fio "deite" no tecido).
 */
export function stitchMatricesAlong(
  points: readonly Vector3[],
  normalAt: (p: Vector3) => Vector3,
  options: StitchOptions,
  out: Matrix4[] = [],
): Matrix4[] {
  if (points.length < 2) return out;
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
  }
  const total = lengths[lengths.length - 1]!;
  const count = Math.floor(total / options.pitch);
  const tangent = new Vector3();
  const normal = new Vector3();
  const binormal = new Vector3();
  const basis = new Matrix4();
  const q = new Quaternion();
  let seg = 1;

  for (let k = 0; k < count; k += 1) {
    const d = (k + 0.5) * options.pitch;
    while (seg < lengths.length - 1 && lengths[seg]! < d) seg += 1;
    const a = points[seg - 1]!;
    const b = points[seg]!;
    const span = lengths[seg]! - lengths[seg - 1]! || 1;
    const t = (d - lengths[seg - 1]!) / span;
    const center = a.clone().lerp(b, t);
    tangent.subVectors(b, a).normalize();
    normal.copy(normalAt(center));
    // Garante base ortonormal: normal perpendicular à tangente.
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal).normalize();
    basis.makeBasis(tangent, normal, binormal);
    q.setFromRotationMatrix(basis);
    center.addScaledVector(normal, options.lift);
    out.push(new Matrix4().compose(center, q, new Vector3(options.length, options.width * 0.6, options.width)));
  }
  return out;
}

