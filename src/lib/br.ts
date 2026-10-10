// Hello World
/** Utilitários brasileiros: CPF, telefone, CEP, UFs e moeda (sempre em centavos). */

export const UFS = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

export type Uf = (typeof UFS)[number]["uf"];

const UF_SET: ReadonlySet<string> = new Set(UFS.map((u) => u.uf));

export function isUf(value: string): value is Uf {
  return UF_SET.has(value);
}

export function ufName(uf: string): string {
  return UFS.find((u) => u.uf === uf)?.name ?? uf;
}

export const onlyDigits = (value: string): string => value.replace(/\D/g, "");

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const dv = (len: number) => {
    const sum = digits.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === digits[9] && dv(10) === digits[10];
}

export function formatCpf(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Mascara o CPF para exibição administrativa (LGPD): ***.456.789-** */
export function maskCpf(input: string): string {
  const d = onlyDigits(input);
  if (d.length !== 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Normaliza para E.164 sem "+": 55 + DDD + número (10 ou 11 dígitos nacionais). */
export function normalizeBrPhone(input: string): string | null {
  let d = onlyDigits(input);
  if (d.length === 12 || d.length === 13) {
    if (!d.startsWith("55")) return null;
    d = d.slice(2);
  }
  if (d.length !== 10 && d.length !== 11) return null;
  if (d.startsWith("0")) return null;
  // Celular com 11 dígitos começa com 9 após o DDD.
  if (d.length === 11 && d[2] !== "9") return null;
  return `55${d}`;
}

export function formatBrPhone(e164: string): string {
  const d = onlyDigits(e164).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export function normalizeCep(input: string): string | null {
  const d = onlyDigits(input);
  return /^\d{8}$/.test(d) ? d : null;
}

export function formatCep(cep: string): string {
  const d = onlyDigits(cep);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/** "129,90" | "129.90" | "1.299,90" → 12990. Retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
