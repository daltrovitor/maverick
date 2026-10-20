// Hello World
import type { StoreSettingsRow } from "@/lib/database.types";

/**
 * Preço do boné personalizado com desconto progressivo por quantidade.
 * Regra (espelhada em public.custom_discount_bps / submit_custom_request no banco):
 * a cada `stepUnits` unidades, `stepBps` de desconto sobre TODAS as unidades, até `maxDiscountBps`.
 * Percentuais em pontos-base (500 = 5%) para manter tudo em inteiros.
 */
export interface CustomPricing {
  readonly unitPriceCents: number | null;
  readonly minQuantity: number;
  readonly maxQuantity: number;
  readonly stepUnits: number;
  readonly stepBps: number;
  readonly maxDiscountBps: number;
}

export interface CustomQuote {
  readonly quantity: number;
  readonly discountBps: number;
  /** Total sem desconto (preço cheio × quantidade). */
  readonly fullCents: number | null;
  readonly totalCents: number | null;
  readonly savingsCents: number | null;
  /** Preço efetivo por unidade, arredondado ao centavo (apenas para exibição). */
  readonly unitCents: number | null;
  /** Próxima faixa de desconto, se ainda existir. */
  readonly next: { readonly quantity: number; readonly discountBps: number } | null;
}

export function pricingFromSettings(
  s: Pick<
    StoreSettingsRow,
    | "custom_unit_price_cents"
    | "custom_min_quantity"
    | "custom_max_quantity"
    | "custom_step_units"
    | "custom_step_bps"
    | "custom_max_discount_bps"
  >,
): CustomPricing {
  return {
    unitPriceCents: s.custom_unit_price_cents,
    minQuantity: s.custom_min_quantity,
    maxQuantity: s.custom_max_quantity,
    stepUnits: s.custom_step_units,
    stepBps: s.custom_step_bps,
    maxDiscountBps: s.custom_max_discount_bps,
  };
}

export function clampQuantity(quantity: number, p: CustomPricing): number {
  if (!Number.isFinite(quantity)) return p.minQuantity;
  return Math.min(p.maxQuantity, Math.max(p.minQuantity, Math.trunc(quantity)));
}

export function discountBpsFor(quantity: number, p: CustomPricing): number {
  if (quantity < 1 || p.stepUnits < 1) return 0;
  return Math.min(Math.floor(quantity / p.stepUnits) * Math.max(p.stepBps, 0), Math.max(p.maxDiscountBps, 0));
}

/** Total com desconto, arredondado ao centavo mais próximo (mesma conta do banco). */
export function totalCentsFor(quantity: number, unitPriceCents: number, discountBps: number): number {
  return Math.floor((unitPriceCents * quantity * (10000 - discountBps) + 5000) / 10000);
}

export function quoteCustom(quantity: number, p: CustomPricing): CustomQuote {
  const q = clampQuantity(quantity, p);
  const discountBps = discountBpsFor(q, p);
  const next = nextTier(q, p);
  if (p.unitPriceCents === null) {
    return { quantity: q, discountBps, fullCents: null, totalCents: null, savingsCents: null, unitCents: null, next };
  }
  const fullCents = p.unitPriceCents * q;
  const totalCents = totalCentsFor(q, p.unitPriceCents, discountBps);
  return {
    quantity: q,
    discountBps,
    fullCents,
    totalCents,
    savingsCents: fullCents - totalCents,
    unitCents: Math.round(totalCents / q),
    next,
  };
}

function nextTier(quantity: number, p: CustomPricing): CustomQuote["next"] {
  const current = discountBpsFor(quantity, p);
  if (p.stepBps <= 0 || p.stepUnits < 1 || current >= p.maxDiscountBps) return null;
  const nextQuantity = (Math.floor(quantity / p.stepUnits) + 1) * p.stepUnits;
  if (nextQuantity > p.maxQuantity) return null;
  return { quantity: nextQuantity, discountBps: discountBpsFor(nextQuantity, p) };
}

/** Faixas de desconto a partir da primeira, até o teto (para a tabela da calculadora). */
export function discountTiers(p: CustomPricing, limit = 8): { quantity: number; discountBps: number }[] {
  const tiers: { quantity: number; discountBps: number }[] = [];
  if (p.stepBps <= 0 || p.stepUnits < 1 || p.maxDiscountBps <= 0) return tiers;
  for (let step = 1; tiers.length < limit; step++) {
    const quantity = step * p.stepUnits;
    if (quantity > p.maxQuantity) break;
    const discountBps = discountBpsFor(quantity, p);
    tiers.push({ quantity, discountBps });
    if (discountBps >= p.maxDiscountBps) break;
  }
  return tiers;
}

/** 500 → "5%", 250 → "2,5%". */
export function formatBps(bps: number): string {
  const value = bps / 100;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** "2,5" / "2.5" / "5" → pontos-base; null se inválido. */
export function parsePercentToBps(input: string): number | null {
  const normalized = input.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number.parseFloat(normalized) * 100);
}
