// Hello World
import { describe, expect, it } from "vitest";
import { analyzeCapPixels } from "@/components/cap/productCapLook";

type Paint = (x: number, y: number) => readonly [number, number, number, number] | null;

/** Foto sintética 200×180: fundo creme, copa (meia elipse), aba embaixo e um logo no meio da frente. */
function photo(paint: Paint): Uint8ClampedArray {
  const w = 200;
  const h = 180;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const color = paint(x, y) ?? ([246, 242, 233, 255] as const);
      data.set(color, i);
    }
  }
  return data;
}

const inCrown = (x: number, y: number) => ((x - 100) / 70) ** 2 + ((y - 120) / 90) ** 2 <= 1 && y <= 120;
const inBrim = (x: number, y: number) => y > 120 && y <= 150 && Math.abs(x - 100) <= 78;

describe("leitura da foto do boné", () => {
  it("acha a cor da copa, a aba diferente e o logo da frente", () => {
    const data = photo((x, y) => {
      if (inCrown(x, y)) {
        if (x >= 85 && x <= 115 && y >= 70 && y <= 98) return [200, 30, 40, 255]; // logo vermelho
        return [30, 32, 70, 255]; // copa azul-marinho
      }
      if (inBrim(x, y)) return [190, 150, 90, 255]; // aba caramelo
      return null;
    });
    const look = analyzeCapPixels(data, 200, 180);
    expect(look).not.toBeNull();
    expect(look!.crown).toEqual([30, 32, 70]);
    expect(look!.brim).toEqual([190, 150, 90]);
    const logo = look!.logo!;
    expect(logo).not.toBeNull();
    // Caixa do logo (com uma pequena margem) ao redor de x 85–115, y 70–98.
    expect(logo.x * 200).toBeGreaterThan(78);
    expect((logo.x + logo.w) * 200).toBeLessThan(122);
    expect(logo.y * 180).toBeGreaterThan(63);
    expect((logo.y + logo.h) * 180).toBeLessThan(105);
    expect(logo.widthRatio).toBeGreaterThan(0.15);
    expect(logo.widthRatio).toBeLessThan(0.3);
  });

  it("boné liso: mesma cor na aba e sem logo", () => {
    const data = photo((x, y) => (inCrown(x, y) || inBrim(x, y) ? [40, 40, 42, 255] : null));
    const look = analyzeCapPixels(data, 200, 180);
    expect(look!.crown).toEqual([40, 40, 42]);
    expect(look!.brim).toEqual([40, 40, 42]);
    expect(look!.logo).toBeNull();
  });

  it("foto recortada (fundo transparente) e foto sem boné", () => {
    const cutout = photo((x, y) => (inCrown(x, y) || inBrim(x, y) ? [120, 20, 30, 255] : [0, 0, 0, 0]));
    expect(analyzeCapPixels(cutout, 200, 180)?.crown).toEqual([120, 20, 30]);
    const empty = photo(() => null);
    expect(analyzeCapPixels(empty, 200, 180)).toBeNull();
  });
});
