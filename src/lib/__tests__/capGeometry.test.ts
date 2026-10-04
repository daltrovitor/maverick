import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  angleOf,
  brimDrop,
  brimStitchRows,
  buildBrimGeometry,
  buildCrownGeometry,
  CAP,
  crownNormal,
  crownPoint,
  isInArch,
} from "@/components/cap/capGeometry";

describe("superfície da copa", () => {
  it("posiciona a testa em +Z e a nuca em −Z", () => {
    expect(crownPoint(0.5, 0).z).toBeCloseTo(CAP.radiusZ, 5);
    expect(crownPoint(0, 0).z).toBeCloseTo(-CAP.radiusZ, 5);
    expect(Math.sin(angleOf(0.5))).toBeCloseTo(1, 6);
  });

  it("converge para um único ápice no botão", () => {
    const a = crownPoint(0.1, 1);
    const b = crownPoint(0.7, 1);
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
    expect(a.y).toBeCloseTo(CAP.apexHeight, 5);
  });

  it("calcula normais apontando para fora", () => {
    for (const u of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const p = crownPoint(u, 0.4);
      const n = crownNormal(u, 0.4);
      expect(n.dot(p.clone().sub(new Vector3(0, 0.3, 0)))).toBeGreaterThan(0);
    }
  });

  it("gera triângulos com winding externo (face frontal visível de fora)", () => {
    const geometry = buildCrownGeometry();
    const index = geometry.getIndex();
    const position = geometry.getAttribute("position");
    expect(index).not.toBeNull();
    const [ia, ib, ic] = [index!.getX(0), index!.getX(1), index!.getX(2)];
    const a = new Vector3().fromBufferAttribute(position, ia);
    const b = new Vector3().fromBufferAttribute(position, ib);
    const c = new Vector3().fromBufferAttribute(position, ic);
    const faceNormal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    expect(faceNormal.dot(centroid.sub(new Vector3(0, 0.3, 0)))).toBeGreaterThan(0);
  });
});

describe("recorte traseiro (arco do fecho)", () => {
  it("abre o arco apenas na nuca e abaixo da altura do arco", () => {
    expect(isInArch(0, 0.1)).toBe(true);
    expect(isInArch(0.99, 0.1)).toBe(true);
    expect(isInArch(0, CAP.archHeight + 0.05)).toBe(false);
    expect(isInArch(0.5, 0.1)).toBe(false);
  });
});

describe("aba pré-curvada", () => {
  it("encaixa na borda frontal rebaixada da copa", () => {
    for (const u of [0.42, 0.5, 0.58]) {
      const rim = crownPoint(u, 0);
      expect(brimDrop(rim.x, rim.z)).toBeCloseTo(rim.y, 3);
    }
  });

  it("curva as laterais para baixo", () => {
    expect(brimDrop(0.8, 1.2)).toBeLessThan(brimDrop(0, 1.6));
  });

  it("gera malha e pespontos válidos", () => {
    const brim = buildBrimGeometry();
    expect(brim.getAttribute("position").count).toBeGreaterThan(100);
    const rows = brimStitchRows();
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      for (const point of row) expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});
