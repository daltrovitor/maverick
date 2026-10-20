// Hello World
import { describe, expect, it } from "vitest";
import {
  clampQuantity,
  discountBpsFor,
  discountTiers,
  formatBps,
  parsePercentToBps,
  quoteCustom,
  totalCentsFor,
  type CustomPricing,
} from "@/lib/custom-pricing";

const pricing: CustomPricing = {
  unitPriceCents: 6000,
  minQuantity: 1,
  maxQuantity: 500,
  stepUnits: 10,
  stepBps: 500,
  maxDiscountBps: 3000,
};

describe("desconto por quantidade", () => {
  it("aplica o percentual a cada faixa completa, sobre todas as unidades", () => {
    expect(discountBpsFor(9, pricing)).toBe(0);
    expect(discountBpsFor(10, pricing)).toBe(500);
    expect(discountBpsFor(25, pricing)).toBe(1000);
    expect(discountBpsFor(59, pricing)).toBe(2500);
  });

  it("respeita o desconto máximo", () => {
    expect(discountBpsFor(60, pricing)).toBe(3000);
    expect(discountBpsFor(500, pricing)).toBe(3000);
  });

  it("calcula o total com arredondamento ao centavo (igual ao banco)", () => {
    const quote = quoteCustom(25, pricing);
    expect(quote.discountBps).toBe(1000);
    expect(quote.fullCents).toBe(150000);
    expect(quote.totalCents).toBe(135000);
    expect(quote.savingsCents).toBe(15000);
    expect(quote.unitCents).toBe(5400);
    // 3 × R$ 33,33 com 2,5%: 9999 × 0,975 = 9749,025 → 9749
    expect(totalCentsFor(3, 3333, 250)).toBe(9749);
  });

  it("indica a próxima faixa enquanto houver desconto a ganhar", () => {
    expect(quoteCustom(25, pricing).next).toEqual({ quantity: 30, discountBps: 1500 });
    expect(quoteCustom(60, pricing).next).toBeNull();
  });

  it("sem preço base, mostra só os percentuais (sob consulta)", () => {
    const quote = quoteCustom(20, { ...pricing, unitPriceCents: null });
    expect(quote.totalCents).toBeNull();
    expect(quote.discountBps).toBe(1000);
  });

  it("mantém a quantidade dentro dos limites do painel", () => {
    expect(clampQuantity(0, pricing)).toBe(1);
    expect(clampQuantity(9999, pricing)).toBe(500);
    expect(clampQuantity(Number.NaN, pricing)).toBe(1);
    expect(quoteCustom(9999, pricing).quantity).toBe(500);
  });

  it("lista as faixas até o teto", () => {
    expect(discountTiers(pricing).map((t) => [t.quantity, t.discountBps])).toEqual([
      [10, 500],
      [20, 1000],
      [30, 1500],
      [40, 2000],
      [50, 2500],
      [60, 3000],
    ]);
    expect(discountTiers({ ...pricing, stepBps: 0 })).toEqual([]);
  });

  it("formata e lê percentuais em pontos-base", () => {
    expect(formatBps(500)).toBe("5%");
    expect(formatBps(250)).toBe("2,5%");
    expect(parsePercentToBps("2,5")).toBe(250);
    expect(parsePercentToBps("10%")).toBe(1000);
    expect(parsePercentToBps("abc")).toBeNull();
  });
});
