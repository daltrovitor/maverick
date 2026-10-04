// Hello World
/**
 * Cotação de frete demonstrativa. Na loja real, os valores vêm da API do Melhor Envio
 * (Correios PAC/SEDEX e Jadlog); aqui reproduzimos a mesma interface com tabela simulada
 * a partir de uma origem no Centro-Oeste.
 */

export type Carrier = "PAC" | "SEDEX" | "Jadlog";

export interface FreightQuote {
  readonly carrier: Carrier;
  readonly company: string;
  readonly price: number;
  readonly originalPrice: number;
  readonly free: boolean;
  readonly days: { readonly min: number; readonly max: number };
}

export type CepParseResult =
  | { readonly ok: true; readonly cep: string; readonly formatted: string; readonly region: string; readonly tier: number }
  | { readonly ok: false; readonly error: string };

export type FreightResult =
  | { readonly ok: true; readonly region: string; readonly formatted: string; readonly quotes: readonly FreightQuote[] }
  | { readonly ok: false; readonly error: string };

export const FREE_SHIPPING_THRESHOLD = 299;

/** Primeiro dígito do CEP → macro-região e distância relativa (0 = local) até a origem. */
const CEP_REGIONS: Readonly<Record<string, { readonly region: string; readonly tier: number }>> = {
  "0": { region: "Grande São Paulo", tier: 1 },
  "1": { region: "Interior de São Paulo", tier: 1 },
  "2": { region: "Rio de Janeiro e Espírito Santo", tier: 2 },
  "3": { region: "Minas Gerais", tier: 1 },
  "4": { region: "Bahia e Sergipe", tier: 2 },
  "5": { region: "Pernambuco, Alagoas, Paraíba e RN", tier: 3 },
  "6": { region: "Norte, Ceará, Piauí e Maranhão", tier: 3 },
  "7": { region: "Centro-Oeste, Tocantins e Rondônia", tier: 0 },
  "8": { region: "Paraná e Santa Catarina", tier: 2 },
  "9": { region: "Rio Grande do Sul", tier: 3 },
};

interface CarrierTable {
  readonly carrier: Carrier;
  readonly company: string;
  readonly base: number;
  readonly perTier: number;
  readonly perExtraItem: number;
  readonly minDays: number;
  readonly maxDays: number;
  readonly daysPerTier: number;
}

const CARRIERS: readonly CarrierTable[] = [
  { carrier: "PAC", company: "Correios", base: 18.9, perTier: 7.5, perExtraItem: 3, minDays: 3, maxDays: 5, daysPerTier: 2 },
  { carrier: "Jadlog", company: "Jadlog .Package", base: 21.4, perTier: 8.2, perExtraItem: 3.5, minDays: 2, maxDays: 4, daysPerTier: 2 },
  { carrier: "SEDEX", company: "Correios", base: 29.9, perTier: 11, perExtraItem: 4.5, minDays: 1, maxDays: 2, daysPerTier: 1 },
];

export function parseCep(input: string): CepParseResult {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 8) {
    return { ok: false, error: "Informe um CEP com 8 dígitos." };
  }
  if (/^(\d)\1{7}$/.test(digits)) {
    return { ok: false, error: "CEP inválido. Confira os números digitados." };
  }
  const info = CEP_REGIONS[digits.charAt(0)];
  if (!info) {
    return { ok: false, error: "CEP fora da área de cobertura." };
  }
  return {
    ok: true,
    cep: digits,
    formatted: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    region: info.region,
    tier: info.tier,
  };
}

/** Máscara progressiva para o campo de CEP: "74000000" → "74000-000". */
export function maskCep(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quoteFreight(cepInput: string, items = 1, subtotal = 159): FreightResult {
  const parsed = parseCep(cepInput);
  if (!parsed.ok) return parsed;

  const safeItems = Math.max(1, Math.floor(Number.isFinite(items) ? items : 1));
  const qualifiesForFree = subtotal >= FREE_SHIPPING_THRESHOLD;

  const quotes = CARRIERS.map((table): FreightQuote => {
    const originalPrice = roundCents(table.base + table.perTier * parsed.tier + table.perExtraItem * (safeItems - 1));
    const free = qualifiesForFree && table.carrier === "PAC";
    return {
      carrier: table.carrier,
      company: table.company,
      originalPrice,
      price: free ? 0 : originalPrice,
      free,
      days: {
        min: table.minDays + table.daysPerTier * parsed.tier,
        max: table.maxDays + table.daysPerTier * parsed.tier,
      },
    };
  }).sort((a, b) => a.price - b.price);

  return { ok: true, region: parsed.region, formatted: parsed.formatted, quotes };
}
