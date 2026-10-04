// Hello World
/** Programa Creator Network: dados de demonstração do painel do afiliado. */

export const COMMISSION_RATE = 0.15;
export const CAP_PRICE = 159;

export type CreatorId = "rodeio" | "crossfit" | "sertanejo" | "lifestyle";

export interface CreatorProfile {
  readonly id: CreatorId;
  readonly label: string;
  readonly niche: string;
  readonly coupon: string;
  /** Cliques nos últimos 7 dias, do mais antigo ao mais recente. */
  readonly weeklyClicks: readonly number[];
  /** Taxa de conversão clique → pedido (0..1). */
  readonly conversion: number;
  /** Comissão já sacada via Pix no mês. */
  readonly withdrawn: number;
}

export const CREATORS: readonly CreatorProfile[] = [
  {
    id: "rodeio",
    label: "Rodeio",
    niche: "Laçadores e provas equestres",
    coupon: "LACO15",
    weeklyClicks: [412, 388, 455, 506, 731, 902, 864],
    conversion: 0.024,
    withdrawn: 600,
  },
  {
    id: "crossfit",
    label: "Crossfit",
    niche: "Atletas e boxes de treino funcional",
    coupon: "FERRO15",
    weeklyClicks: [618, 642, 590, 701, 688, 540, 497],
    conversion: 0.019,
    withdrawn: 450,
  },
  {
    id: "sertanejo",
    label: "Sertanejo",
    niche: "Artistas e bastidores de shows",
    coupon: "MODAO15",
    weeklyClicks: [980, 1104, 1320, 1215, 1630, 2240, 2105],
    conversion: 0.014,
    withdrawn: 1200,
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    niche: "Vida no campo e moda rústica",
    coupon: "CAMPO15",
    weeklyClicks: [302, 344, 371, 365, 410, 468, 452],
    conversion: 0.031,
    withdrawn: 300,
  },
];

export interface CreatorMetrics {
  readonly clicks: number;
  readonly sales: number;
  readonly commission: number;
  readonly balance: number;
  readonly conversion: number;
}

export function computeCreatorMetrics(profile: CreatorProfile): CreatorMetrics {
  const clicks = profile.weeklyClicks.reduce((sum, value) => sum + value, 0);
  const sales = Math.round(clicks * profile.conversion);
  const commission = sales * CAP_PRICE * COMMISSION_RATE;
  return {
    clicks,
    sales,
    commission,
    balance: Math.max(0, commission - profile.withdrawn),
    conversion: profile.conversion,
  };
}

export function buildAffiliateLink(coupon: string): string {
  return `maverickcapshop.com.br/c/${coupon.toLowerCase()}`;
}
