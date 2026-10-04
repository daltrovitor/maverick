import { describe, expect, it } from "vitest";
import { FREE_SHIPPING_THRESHOLD, maskCep, parseCep, quoteFreight } from "@/lib/freight";

describe("parseCep", () => {
  it("aceita CEP com ou sem hífen", () => {
    const withDash = parseCep("74000-000");
    const plain = parseCep("74000000");
    expect(withDash.ok && withDash.formatted).toBe("74000-000");
    expect(plain.ok && plain.cep).toBe("74000000");
  });

  it("rejeita CEP incompleto ou repetido", () => {
    expect(parseCep("7400").ok).toBe(false);
    expect(parseCep("11111111").ok).toBe(false);
    expect(parseCep("abc").ok).toBe(false);
  });

  it("identifica a macro-região pelo primeiro dígito", () => {
    const sp = parseCep("01310-100");
    expect(sp.ok && sp.region).toBe("Grande São Paulo");
  });
});

describe("maskCep", () => {
  it("aplica máscara progressiva e limita a 8 dígitos", () => {
    expect(maskCep("7400")).toBe("7400");
    expect(maskCep("740001234567")).toBe("74000-123");
    expect(maskCep("74a00b0000")).toBe("74000-000");
  });
});

describe("quoteFreight", () => {
  it("retorna PAC, SEDEX e Jadlog ordenados por preço", () => {
    const result = quoteFreight("90000-000");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quotes.map((quote) => quote.carrier).sort()).toEqual(["Jadlog", "PAC", "SEDEX"]);
    const prices = result.quotes.map((quote) => quote.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("cobra mais e demora mais para regiões distantes da origem", () => {
    const near = quoteFreight("74000-000");
    const far = quoteFreight("90000-000");
    if (!near.ok || !far.ok) throw new Error("cotação deveria ser válida");
    const nearPac = near.quotes.find((quote) => quote.carrier === "PAC");
    const farPac = far.quotes.find((quote) => quote.carrier === "PAC");
    expect(farPac!.price).toBeGreaterThan(nearPac!.price);
    expect(farPac!.days.max).toBeGreaterThan(nearPac!.days.max);
  });

  it("libera PAC grátis acima do valor mínimo do pedido", () => {
    const result = quoteFreight("01310-100", 2, FREE_SHIPPING_THRESHOLD);
    if (!result.ok) throw new Error("cotação deveria ser válida");
    const pac = result.quotes.find((quote) => quote.carrier === "PAC");
    expect(pac?.free).toBe(true);
    expect(pac?.price).toBe(0);
    expect(pac?.originalPrice).toBeGreaterThan(0);
  });

  it("propaga erro de validação do CEP", () => {
    const result = quoteFreight("123");
    expect(result.ok).toBe(false);
  });
});
