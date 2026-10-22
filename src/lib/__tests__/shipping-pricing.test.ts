// Hello World
import { describe, expect, it } from "vitest";
import { displayPrice, parseDelivery, unitPriceFor, type ShippingPricing } from "@/lib/shipping-pricing";

const pricing: ShippingPricing = {
  inPrice: true,
  rates: [
    { uf: "GO", cents: 1990, estimate: "3 a 5 dias úteis" },
    { uf: "SP", cents: 2490, estimate: null },
  ],
};

describe("frete embutido no preço", () => {
  it("soma o frete da UF ao preço quando o destino é conhecido", () => {
    expect(displayPrice(12990, pricing, "SP")).toEqual({ cents: 15480, from: false, unserved: false });
    expect(unitPriceFor(12990, pricing, "GO")).toBe(14980);
  });

  it("sem destino mostra o menor valor como 'a partir de'", () => {
    expect(displayPrice(12990, pricing, null)).toEqual({ cents: 14980, from: true, unserved: false });
    const flat: ShippingPricing = { inPrice: true, rates: [{ uf: "GO", cents: 1000, estimate: null }, { uf: "SP", cents: 1000, estimate: null }] };
    expect(displayPrice(5000, flat, null)).toEqual({ cents: 6000, from: false, unserved: false });
  });

  it("marca o destino não atendido e mantém o 'a partir de'", () => {
    expect(displayPrice(12990, pricing, "AM")).toEqual({ cents: 14980, from: true, unserved: true });
    expect(unitPriceFor(12990, pricing, "AM")).toBe(12990);
  });

  it("com o frete fora do preço, a vitrine mostra o valor do produto", () => {
    const separate: ShippingPricing = { ...pricing, inPrice: false };
    expect(displayPrice(12990, separate, "SP")).toEqual({ cents: 12990, from: false, unserved: false });
    expect(unitPriceFor(12990, separate, "SP")).toBe(12990);
  });

  it("só aceita destino guardado com CEP e UF válidos", () => {
    expect(parseDelivery(JSON.stringify({ cep: "01310-100", uf: "SP", city: "São Paulo" }))).toEqual({
      cep: "01310100",
      uf: "SP",
      city: "São Paulo",
    });
    expect(parseDelivery(JSON.stringify({ cep: "123", uf: "SP" }))).toBeNull();
    expect(parseDelivery(JSON.stringify({ cep: "01310100", uf: "XX" }))).toBeNull();
    expect(parseDelivery("{quebrado")).toBeNull();
    expect(parseDelivery(null)).toBeNull();
  });
});
