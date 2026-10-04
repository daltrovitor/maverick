// Hello World
/**
 * Simulador do acordo ViraWeb × Maverick (25% dos lucros líquidos + 25% de equity).
 * Todas as premissas ficam explícitas aqui para que a proposta seja auditável.
 */

export type TicketMode = "cap" | "combo";

export interface UnitEconomics {
  readonly label: string;
  /** Preço médio pago pelo cliente por pedido. */
  readonly averageTicket: number;
  /** Custo de produção da(s) peça(s) do pedido. */
  readonly productCost: number;
  /** Embalagem premium + subsídio de frete por pedido. */
  readonly fulfillmentCost: number;
}

export const UNIT_ECONOMICS: Readonly<Record<TicketMode, UnitEconomics>> = {
  cap: {
    label: "Boné Maverick",
    averageTicket: 159,
    productCost: 48,
    fulfillmentCost: 12,
  },
  combo: {
    label: "Combo boné + camiseta Gym",
    averageTicket: 420,
    productCost: 110,
    fulfillmentCost: 15,
  },
};

/** Custos proporcionais ao faturamento. */
export const REVENUE_RATES = {
  /** Simples Nacional (faixa inicial estimada). */
  taxes: 0.08,
  /** Mix Pix + cartão no gateway. */
  payments: 0.035,
  /** 15% de comissão sobre ~30% das vendas vindas de afiliados. */
  affiliates: 0.045,
  /** Tráfego pago de apoio, conteúdo e operação. */
  marketing: 0.1,
} as const;

export const VIRAWEB_SHARE = 0.25;
export const MAVERICK_SHARE = 1 - VIRAWEB_SHARE;

/** Múltiplo conservador de receita anual para marcas D2C com tecnologia própria. */
export const VALUATION_REVENUE_MULTIPLE = 2;

export const UNITS_MIN = 100;
export const UNITS_MAX = 3000;
export const UNITS_STEP = 50;
export const UNITS_PRESETS = [200, 500, 1000, 3000] as const;

export interface CostBreakdown {
  readonly product: number;
  readonly fulfillment: number;
  readonly taxes: number;
  readonly payments: number;
  readonly affiliates: number;
  readonly marketing: number;
}

export interface SimulationResult {
  readonly mode: TicketMode;
  readonly units: number;
  readonly grossRevenue: number;
  readonly costs: CostBreakdown;
  readonly totalCosts: number;
  readonly netProfit: number;
  /** Lucro líquido / faturamento bruto (0..1). */
  readonly netMargin: number;
  readonly maverickProfit: number;
  readonly virawebProfit: number;
  readonly annualRevenue: number;
  readonly annualNetProfit: number;
  readonly valuation: number;
  readonly maverickEquityValue: number;
  readonly virawebEquityValue: number;
}

/** Normaliza a entrada do slider: inteiro, finito e dentro da faixa suportada. */
export function clampUnits(units: number): number {
  if (!Number.isFinite(units)) return UNITS_MIN;
  return Math.min(UNITS_MAX, Math.max(0, Math.round(units)));
}

export function simulate(rawUnits: number, mode: TicketMode = "cap"): SimulationResult {
  const units = clampUnits(rawUnits);
  const economics = UNIT_ECONOMICS[mode];
  const grossRevenue = units * economics.averageTicket;

  const costs: CostBreakdown = {
    product: units * economics.productCost,
    fulfillment: units * economics.fulfillmentCost,
    taxes: grossRevenue * REVENUE_RATES.taxes,
    payments: grossRevenue * REVENUE_RATES.payments,
    affiliates: grossRevenue * REVENUE_RATES.affiliates,
    marketing: grossRevenue * REVENUE_RATES.marketing,
  };

  const totalCosts =
    costs.product + costs.fulfillment + costs.taxes + costs.payments + costs.affiliates + costs.marketing;
  const netProfit = grossRevenue - totalCosts;
  const netMargin = grossRevenue > 0 ? netProfit / grossRevenue : 0;

  const annualRevenue = grossRevenue * 12;
  const valuation = annualRevenue * VALUATION_REVENUE_MULTIPLE;

  return {
    mode,
    units,
    grossRevenue,
    costs,
    totalCosts,
    netProfit,
    netMargin,
    maverickProfit: netProfit * MAVERICK_SHARE,
    virawebProfit: netProfit * VIRAWEB_SHARE,
    annualRevenue,
    annualNetProfit: netProfit * 12,
    valuation,
    maverickEquityValue: valuation * MAVERICK_SHARE,
    virawebEquityValue: valuation * VIRAWEB_SHARE,
  };
}
