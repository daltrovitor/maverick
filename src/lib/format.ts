// Hello World
const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const brlCentsFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** R$ 12.345 — valores de painel, sem centavos. */
export function formatBRL(value: number): string {
  return brlFormatter.format(Number.isFinite(value) ? value : 0);
}

/** R$ 159,00 — preços de produto e frete, com centavos. */
export function formatBRLCents(value: number): string {
  return brlCentsFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatInteger(value: number): string {
  return integerFormatter.format(Number.isFinite(value) ? value : 0);
}

/** 0.363 → "36,3%" */
export function formatPercent(ratio: number): string {
  return percentFormatter.format(Number.isFinite(ratio) ? ratio : 0);
}

/** Compacta valores grandes para leitura rápida: 1.250.000 → "R$ 1,25 mi". */
export function formatBRLCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  if (abs >= 1_000_000) {
    return `R$ ${(safe / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  }
  if (abs >= 10_000) {
    return `R$ ${(safe / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return formatBRL(safe);
}

export function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}
