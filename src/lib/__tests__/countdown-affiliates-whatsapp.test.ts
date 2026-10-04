import { describe, expect, it } from "vitest";
import { getTimeLeft, nextDropDate } from "@/lib/countdown";
import { buildAffiliateLink, CAP_PRICE, COMMISSION_RATE, computeCreatorMetrics, CREATORS } from "@/lib/affiliates";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

describe("nextDropDate", () => {
  it("agenda para sexta às 20h de Brasília (23h UTC)", () => {
    // Segunda-feira, 5 de outubro de 2026, 10h em Brasília.
    const drop = nextDropDate(new Date("2026-10-05T13:00:00Z"));
    expect(drop.toISOString()).toBe("2026-10-09T23:00:00.000Z");
  });

  it("usa o mesmo dia quando ainda é sexta antes das 20h", () => {
    const drop = nextDropDate(new Date("2026-10-09T18:00:00Z"));
    expect(drop.toISOString()).toBe("2026-10-09T23:00:00.000Z");
  });

  it("pula para a próxima semana depois do horário do drop", () => {
    const drop = nextDropDate(new Date("2026-10-09T23:30:00Z"));
    expect(drop.toISOString()).toBe("2026-10-16T23:00:00.000Z");
  });

  it("respeita o dia da semana de Brasília perto da meia-noite UTC", () => {
    // Sábado 01h UTC ainda é sexta 22h em Brasília → drop desta sexta já passou.
    const drop = nextDropDate(new Date("2026-10-10T01:00:00Z"));
    expect(drop.toISOString()).toBe("2026-10-16T23:00:00.000Z");
  });
});

describe("getTimeLeft", () => {
  it("decompõe a diferença em dias, horas, minutos e segundos", () => {
    const now = Date.UTC(2026, 9, 5, 0, 0, 0);
    const target = now + ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(getTimeLeft(target, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
  });

  it("nunca retorna valores negativos", () => {
    expect(getTimeLeft(0, 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
});

describe("computeCreatorMetrics", () => {
  it("calcula comissão de 15% por boné vendido", () => {
    const profile = CREATORS[0]!;
    const metrics = computeCreatorMetrics(profile);
    expect(metrics.commission).toBeCloseTo(metrics.sales * CAP_PRICE * COMMISSION_RATE, 6);
    expect(metrics.balance).toBeGreaterThanOrEqual(0);
  });

  it("gera link rastreável em minúsculas", () => {
    expect(buildAffiliateLink("LACO15")).toBe("maverickcapshop.com.br/c/laco15");
  });
});

describe("buildWhatsAppUrl", () => {
  it("codifica a mensagem pré-formatada", () => {
    const url = buildWhatsAppUrl("Olá, ViraWeb! 25% & equity");
    expect(url).toBe("https://wa.me/5562992516554?text=Ol%C3%A1%2C%20ViraWeb!%2025%25%20%26%20equity");
  });

  it("rejeita números inválidos", () => {
    expect(() => buildWhatsAppUrl("oi", "123")).toThrow();
  });
});
