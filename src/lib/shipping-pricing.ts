// Hello World
/**
 * Frete embutido no preço (regra espelhada do banco, ver _compute_cart): com a chave ligada, o
 * valor cadastrado para a UF de entrega é somado a CADA unidade e o pedido sai com frete grátis.
 * Aqui só se calcula o que a vitrine mostra; o valor cobrado é sempre o do banco.
 */
import { isUf, normalizeCep } from "@/lib/br";

export interface DeliveryRate {
  readonly uf: string;
  readonly cents: number;
  readonly estimate: string | null;
}

export interface ShippingPricing {
  /** Frete somado ao preço de cada unidade (cliente vê frete grátis). */
  readonly inPrice: boolean;
  /** Só as UFs atendidas (regras ativas). */
  readonly rates: readonly DeliveryRate[];
}

/** Destino escolhido pelo cliente (CEP conferido no ViaCEP), guardado no navegador. */
export interface Delivery {
  readonly cep: string;
  readonly uf: string;
  readonly city: string | null;
}

export const NO_SHIPPING_PRICING: ShippingPricing = { inPrice: false, rates: [] };

export function rateFor(pricing: ShippingPricing, uf: string | null | undefined): DeliveryRate | null {
  if (!uf) return null;
  return pricing.rates.find((r) => r.uf === uf) ?? null;
}

export interface DisplayPrice {
  /** Valor a exibir (centavos). */
  readonly cents: number;
  /** "a partir de": o destino ainda não é conhecido e o frete varia entre as UFs. */
  readonly from: boolean;
  /** O destino escolhido não é atendido (o checkout bloqueia essa UF). */
  readonly unserved: boolean;
}

/**
 * Preço de vitrine para o destino atual. Sem destino, mostra o menor valor possível como
 * "a partir de" (ou o valor exato, quando todas as UFs custam o mesmo).
 */
export function displayPrice(baseCents: number, pricing: ShippingPricing, uf: string | null | undefined): DisplayPrice {
  if (!pricing.inPrice || pricing.rates.length === 0) return { cents: baseCents, from: false, unserved: false };
  const rate = rateFor(pricing, uf);
  if (rate) return { cents: baseCents + rate.cents, from: false, unserved: false };
  const values = pricing.rates.map((r) => r.cents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { cents: baseCents + min, from: min !== max, unserved: Boolean(uf) };
}

/** Preço unitário exato para a UF, ou o base quando o frete não entra no preço / não há regra. */
export function unitPriceFor(baseCents: number, pricing: ShippingPricing, uf: string | null | undefined): number {
  if (!pricing.inPrice) return baseCents;
  return baseCents + (rateFor(pricing, uf)?.cents ?? 0);
}

/** Lê com segurança o destino guardado (o navegador pode ter qualquer coisa nessa chave). */
export function parseDelivery(raw: string | null): Delivery | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { cep, uf, city } = value as Record<string, unknown>;
    if (typeof cep !== "string" || typeof uf !== "string") return null;
    const normalized = normalizeCep(cep);
    if (!normalized || !isUf(uf)) return null;
    return { cep: normalized, uf, city: typeof city === "string" && city.length <= 80 ? city : null };
  } catch {
    return null;
  }
}
