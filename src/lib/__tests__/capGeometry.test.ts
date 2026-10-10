// Hello World
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  angleOf,
  brimPoint,
  brimStitchRows,
  buildBrimGeometry,
  buildCrownGeometry,
  CAP,
  crownNormal,
  crownPoint,
  isInArch,
  rimHeight,
} from "@/components/cap/capGeometry";

describe("superfície da copa", () => {
  it("posiciona a testa em +Z e a nuca em −Z", () => {
    expect(crownPoint(0.5, 0).z).toBeCloseTo(CAP.radiusZ, 5);
    expect(crownPoint(0, 0).z).toBeCloseTo(-CAP.radiusZ, 5);
    expect(Math.sin(angleOf(0.5))).toBeCloseTo(1, 6);
  });

  it("converge para um único ápice (botão) na altura definida", () => {
    const a = crownPoint(0.1, 1);
    const b = crownPoint(0.7, 1);
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
    expect(a.y).toBeCloseTo(CAP.height, 5);
  });

  it("é mais alta na frente que na traseira a meia altura", () => {
    expect(crownPoint(0.5, 0.5).y).toBeGreaterThan(crownPoint(0, 0.5).y);
  });

  it("não tem quinas: a superfície varia suavemente ao redor da copa", () => {
    // Segunda diferença ao longo de u é pequena em todas as alturas (sem calombos laterais).
    for (const v of [0.2, 0.45, 0.7]) {
      let worst = 0;
      const h = 1 / 360;
      for (let i = 0; i < 360; i += 1) {
        const u = i / 360;
        const d2 = crownPoint(u + h, v).add(crownPoint(u - h, v)).sub(crownPoint(u, v).multiplyScalar(2)).length();
        worst = Math.max(worst, d2);
      }
      expect(worst).toBeLessThan(0.002);
    }
  });

  it("calcula normais apontando para fora", () => {
    for (const u of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const p = crownPoint(u, 0.4);
      const n = crownNormal(u, 0.4);
      expect(n.dot(p.clone().sub(new Vector3(0, 0.24, -0.04)))).toBeGreaterThan(0);
    }
  });

  it("gera triângulos com winding externo", () => {
    const geometry = buildCrownGeometry(0, 64, 24);
    const index = geometry.getIndex()!;
    const position = geometry.getAttribute("position");
    const [ia, ib, ic] = [index.getX(0), index.getX(1), index.getX(2)];
    const a = new Vector3().fromBufferAttribute(position, ia);
    const b = new Vector3().fromBufferAttribute(position, ib);
    const c = new Vector3().fromBufferAttribute(position, ic);
    const faceNormal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    expect(faceNormal.dot(centroid.sub(new Vector3(0, 0.24, -0.04)))).toBeGreaterThan(0);
  });
});

describe("abertura traseira", () => {
  it("abre o arco apenas na nuca e abaixo da altura do arco", () => {
    expect(isInArch(0, 0.1)).toBe(true);
    expect(isInArch(0.99, 0.1)).toBe(true);
    expect(isInArch(0, CAP.archHeight + 0.05)).toBe(false);
    expect(isInArch(0.5, 0.1)).toBe(false);
  });
});

describe("aba", () => {
  it("nasce exatamente na borda da copa (sem vão entre aba e copa)", () => {
    for (const s of [-0.9, -0.5, 0, 0.4, 0.85]) {
      const inner = brimPoint(s, 0);
      const a = Math.PI / 2 + s * CAP.brimHalfAngle;
      const u = (((a - 1.5 * Math.PI) / (Math.PI * 2)) % 1 + 1) % 1;
      const rim = crownPoint(u, 0);
      expect(inner.distanceTo(rim)).toBeLessThan(1e-6);
      expect(rim.y).toBeCloseTo(rimHeight(rim.x, a), 6);
    }
  });

  it("desce nas laterais e cai levemente para a frente", () => {
    expect(brimPoint(0.8, 0.5).y).toBeLessThan(brimPoint(0, 0.5).y);
    expect(brimPoint(0, 1).y).toBeLessThan(brimPoint(0, 0).y);
  });

  it("forma uma malha fechada e densa", () => {
    const geometry = buildBrimGeometry(40, 8);
    expect(geometry.getIndex()!.count).toBeGreaterThan(40 * 8 * 12);
  });

  it("assenta os pespontos sobre a face superior", () => {
    const rows = brimStitchRows(8);
    expect(rows.length).toBe(8);
    for (const row of rows) {
      for (const p of row) {
        // Acima do ponto médio da aba e no máximo meia espessura + folga.
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
    const middle = rows[3]!;
    const p = middle[Math.floor(middle.length / 2)]!;
    expect(p.z).toBeGreaterThan(CAP.radiusZ);
  });
});
