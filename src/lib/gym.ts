// Hello World
/** Montagem de kit da linha Maverick Gym e impacto no ticket médio. */
import { GYM_PRODUCTS, type GymProduct } from "@/lib/content";

export const BASE_CAP_PRICE = 159;
/** Combo boné + camiseta oversized (preço cheio R$ 438). */
export const CAP_TEE_COMBO_PRICE = 420;

export type GymItemId = GymProduct["id"];

export interface KitSummary {
  readonly total: number;
  readonly fullPrice: number;
  readonly savings: number;
  readonly comboApplied: boolean;
  /** Variação do ticket em relação a um pedido só com boné (0.5 = +50%). */
  readonly upliftVsCap: number;
}

/** O boné Maverick é sempre a âncora do pedido; os itens Gym somam ao ticket. */
export function summarizeKit(selected: readonly GymItemId[]): KitSummary {
  const unique = Array.from(new Set(selected));
  const items = GYM_PRODUCTS.filter((product) => unique.includes(product.id));
  const fullPrice = BASE_CAP_PRICE + items.reduce((sum, product) => sum + product.price, 0);
  const tee = items.find((product) => product.id === "camiseta");
  const comboApplied = Boolean(tee);
  const total = comboApplied && tee ? fullPrice - (BASE_CAP_PRICE + tee.price) + CAP_TEE_COMBO_PRICE : fullPrice;
  return {
    total,
    fullPrice,
    savings: fullPrice - total,
    comboApplied,
    upliftVsCap: total / BASE_CAP_PRICE - 1,
  };
}
