import { describe, expect, it } from "vitest";
import {
  clampUnits,
  MAVERICK_SHARE,
  simulate,
  UNITS_MAX,
  UNITS_MIN,
  VALUATION_REVENUE_MULTIPLE,
  VIRAWEB_SHARE,
} from "@/lib/simulator";

describe("simulate", () => {
  it("calcula faturamento bruto a partir do ticket médio do boné (R$ 159)", () => {
    const result = simulate(500, "cap");
    expect(result.grossRevenue).toBe(79_500);
  });

  it("aplica o ticket do combo Gym (R$ 420)", () => {
    expect(simulate(200, "combo").grossRevenue).toBe(84_000);
  });

  it("divide o lucro líquido 75% Maverick / 25% ViraWeb sem perder centavos", () => {
    const result = simulate(1000, "cap");
    expect(result.maverickProfit + result.virawebProfit).toBeCloseTo(result.netProfit, 6);
    expect(result.virawebProfit).toBeCloseTo(result.netProfit * VIRAWEB_SHARE, 6);
    expect(MAVERICK_SHARE).toBe(0.75);
  });

  it("mantém margem líquida positiva e plausível para o modelo D2C", () => {
    const cap = simulate(1000, "cap");
    const combo = simulate(1000, "combo");
    expect(cap.netMargin).toBeGreaterThan(0.3);
    expect(cap.netMargin).toBeLessThan(0.45);
    expect(combo.netMargin).toBeGreaterThan(cap.netMargin);
  });

  it("projeta valuation como múltiplo da receita anualizada", () => {
    const result = simulate(3000, "cap");
    expect(result.annualRevenue).toBe(result.grossRevenue * 12);
    expect(result.valuation).toBe(result.annualRevenue * VALUATION_REVENUE_MULTIPLE);
    expect(result.virawebEquityValue + result.maverickEquityValue).toBeCloseTo(result.valuation, 6);
  });

  it("soma do detalhamento de custos é igual ao custo total", () => {
    const { costs, totalCosts } = simulate(750, "combo");
    const sum = Object.values(costs).reduce((acc, value) => acc + value, 0);
    expect(sum).toBeCloseTo(totalCosts, 6);
  });
});

describe("clampUnits", () => {
  it("arredonda e limita a faixa suportada", () => {
    expect(clampUnits(512.6)).toBe(513);
    expect(clampUnits(UNITS_MAX + 900)).toBe(UNITS_MAX);
    expect(clampUnits(-20)).toBe(0);
  });

  it("trata entradas não numéricas com fallback seguro", () => {
    expect(clampUnits(Number.NaN)).toBe(UNITS_MIN);
    expect(simulate(Number.POSITIVE_INFINITY).units).toBe(UNITS_MIN);
  });

  it("não divide por zero quando não há vendas", () => {
    expect(simulate(0).netMargin).toBe(0);
  });
});
