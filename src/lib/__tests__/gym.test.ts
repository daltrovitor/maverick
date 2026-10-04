import { describe, expect, it } from "vitest";
import { BASE_CAP_PRICE, CAP_TEE_COMBO_PRICE, summarizeKit } from "@/lib/gym";

describe("summarizeKit", () => {
  it("parte do ticket de um boné (R$ 159)", () => {
    const kit = summarizeKit([]);
    expect(kit.total).toBe(BASE_CAP_PRICE);
    expect(kit.upliftVsCap).toBe(0);
    expect(kit.comboApplied).toBe(false);
  });

  it("aplica o combo boné + camiseta de R$ 420", () => {
    const kit = summarizeKit(["camiseta"]);
    expect(kit.total).toBe(CAP_TEE_COMBO_PRICE);
    expect(kit.comboApplied).toBe(true);
    expect(kit.savings).toBe(kit.fullPrice - CAP_TEE_COMBO_PRICE);
    expect(kit.upliftVsCap).toBeCloseTo(420 / 159 - 1, 6);
  });

  it("soma itens extras ao combo e ignora duplicados", () => {
    const kit = summarizeKit(["camiseta", "regata", "regata"]);
    expect(kit.total).toBe(CAP_TEE_COMBO_PRICE + 129);
  });

  it("soma itens avulsos sem desconto quando não há camiseta", () => {
    const kit = summarizeKit(["dryfit", "bermuda"]);
    expect(kit.total).toBe(BASE_CAP_PRICE + 169 + 149);
    expect(kit.savings).toBe(0);
  });
});
