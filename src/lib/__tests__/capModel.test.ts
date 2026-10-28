// Hello World
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_ANCHORS, MODEL_BOUNDS, MODEL_CREDIT } from "@/components/cap/capModelAnchors";

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
