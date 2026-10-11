// Hello World
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_ANCHORS, MODEL_BOUNDS, MODEL_CREDIT, type ModelAnchorId } from "@/components/cap/capModelAnchors";
import { ACTS, SHOTS, actAt, rigAt } from "@/components/landing/cinematicActs";

/** Lê o JSON de um .glb (cabeçalho de 12 bytes + bloco JSON). */
function readGlbJson(path: string) {
  const data = readFileSync(path);
  expect(data.toString("ascii", 0, 4)).toBe("glTF");
  const length = data.readUInt32LE(12);
  expect(data.toString("ascii", 16, 20)).toBe("JSON");
  return { size: data.length, json: JSON.parse(data.toString("utf8", 20, 20 + length)) as Record<string, unknown> };
}

describe("modelo 3D do boné (public/models/polo/cap.glb)", () => {
  const { size, json } = readGlbJson(join(process.cwd(), "public", "models", "polo", "cap.glb"));

  it("usa só material PBR padrão (o three.js não lê mais specular-glossiness)", () => {
    expect(json.extensionsRequired ?? []).toEqual([]);
    expect(JSON.stringify(json)).not.toContain("KHR_materials_pbrSpecularGlossiness");
    const names = (json.materials as { name: string }[]).map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(["fabric", "strap"]));
  });

  it("traz a textura nova embutida e o crédito da licença", () => {
    expect((json.images as unknown[]).length).toBeGreaterThanOrEqual(2);
    const asset = json.asset as { copyright?: string };
    expect(asset.copyright).toContain(MODEL_CREDIT.author);
    expect(asset.copyright).toContain("CC BY 4.0");
  });

  it("mantém as peças do modelo original e um tamanho razoável para a web", () => {
    const meshes = (json.meshes as { name: string }[]).map((m) => m.name);
    expect(meshes).toEqual(expect.arrayContaining(["crown", "brim", "button", "sweatband"]));
    expect(size).toBeLessThan(4.5e6);
  });
});

describe("âncoras do modelo", () => {
  const inside = (p: readonly number[]) =>
    p.every((v, i) => v >= MODEL_BOUNDS.min[i]! - 0.05 && v <= MODEL_BOUNDS.max[i]! + 0.05);

  it("ficam sobre o boné", () => {
    for (const point of Object.values(MODEL_ANCHORS)) expect(inside(point)).toBe(true);
  });

  it("frente e trás estão nos lados certos (aba em +Z)", () => {
    expect(MODEL_ANCHORS.pony[2]).toBeGreaterThan(0.5);
    expect(MODEL_ANCHORS.polo[2]).toBeLessThan(-0.5);
    expect(MODEL_ANCHORS.brim[2]).toBeGreaterThan(MODEL_ANCHORS.pony[2]);
    expect(MODEL_ANCHORS.button[1]).toBe(MODEL_BOUNDS.max[1]);
  });
});

describe("roteiro da apresentação", () => {
  const anchorIds = new Set<string>(Object.keys(MODEL_ANCHORS));
  const anchor = (id: string) => {
    if (id === "center") return { x: 0, y: 0, z: 0 };
    const [x, y, z] = MODEL_ANCHORS[id as ModelAnchorId];
    return { x, y, z };
  };

  it("tomadas em ordem, cobrindo a rolagem inteira, com focos que existem", () => {
    const ats = SHOTS.map((s) => s.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(ats[0]).toBe(0);
    expect(ats.at(-1)).toBe(1);
    for (const shot of SHOTS) expect(shot.focus === "center" || anchorIds.has(shot.focus)).toBe(true);
  });

  it("anotações apontam só para pontos do modelo", () => {
    for (const act of ACTS) for (const note of act.annotations) expect(anchorIds.has(note.anchor)).toBe(true);
  });

  it("o boné nunca é aproximado a ponto de estourar a área dele", () => {
    for (const shot of SHOTS) expect(shot.dist).toBeGreaterThanOrEqual(0.68);
  });

  it("a câmera e a pose variam sem saltos ao longo da rolagem", () => {
    // Amostragem fina: um erro de roteiro (tomada fora de ordem, valor trocado) aparece como salto.
    const samples = 20000;
    let previous = rigAt(0, anchor);
    for (let i = 1; i <= samples; i += 1) {
      const p = i / samples;
      const rig = rigAt(p, anchor);
      expect(Math.abs(rig.az - previous.az)).toBeLessThan(0.02);
      expect(Math.abs(rig.el - previous.el)).toBeLessThan(0.02);
      expect(Math.abs(rig.dist - previous.dist)).toBeLessThan(0.005);
      expect(Math.abs(rig.spin - previous.spin)).toBeLessThan(0.02);
      expect(Math.abs(rig.lift - previous.lift)).toBeLessThan(0.005);
      // No 360° o giro é uma volta só, sempre no mesmo sentido.
      if (p >= 0.79 && p <= 0.88) expect(rig.spin - previous.spin).toBeLessThanOrEqual(1e-9);
      previous = rig;
    }
  });

  it("termina de frente: o giro de 360° fecha uma volta inteira", () => {
    const end = rigAt(1, anchor);
    expect(Math.abs(end.spin % (Math.PI * 2))).toBeLessThan(1e-9);
  });

  it("cada ato começa onde o anterior termina", () => {
    expect(actAt(0)).toBe(0);
    expect(actAt(1)).toBe(ACTS.length - 1);
    ACTS.forEach((act, i) => expect(actAt(act.range[0] + 0.001)).toBe(i));
  });
});
