// Hello World
import { z } from "zod";
import { isUf, isValidCpf, normalizeBrPhone, normalizeCep } from "@/lib/br";

/** Esquemas de entrada compartilhados (validados no servidor antes de tocar no banco). */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}: mínimo de ${min} caracteres`)
    .max(max, `${label}: máximo de ${max} caracteres`);

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeBrPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Telefone inválido: use DDD + número" });
      return z.NEVER;
    }
    return n;
  });

export const cepSchema = z.string().transform((v, ctx) => {
  const n = normalizeCep(v);
  if (!n) {
    ctx.addIssue({ code: "custom", message: "CEP inválido" });
    return z.NEVER;
  }
  return n;
});

export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isUf, "UF inválida");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido").max(160));

export const cartItemSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(20),
});

export const cartSchema = z.array(cartItemSchema).min(1, "Sua sacola está vazia").max(20);

export const addressSchema = z.object({
  cep: cepSchema,
  street: trimmed(2, 120, "Rua"),
  number: trimmed(1, 20, "Número"),
  complement: z.string().trim().max(60).optional().transform((v) => v || null),
  district: trimmed(2, 80, "Bairro"),
  city: trimmed(2, 80, "Cidade"),
  uf: ufSchema,
});

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  paymentMethod: z.enum(["pix", "card"]),
  customer: z.object({
    name: trimmed(3, 120, "Nome"),
    email: emailSchema,
    phone: phoneSchema,
  }),
  address: addressSchema,
  items: cartSchema,
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(32)
    .optional()
    .transform((v) => v || undefined),
  notes: z.string().trim().max(500).optional(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export const quoteSchema = z.object({
  items: cartSchema,
  uf: ufSchema,
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  email: z.string().trim().toLowerCase().max(160).optional(),
});

export const AFFILIATE_CHANNELS = [
  { value: "stories", label: "Stories" },
  { value: "reels", label: "Reels / vídeos curtos" },
  { value: "feed", label: "Posts no feed" },
  { value: "live", label: "Lives" },
  { value: "youtube", label: "Vídeos longos" },
  { value: "whatsapp", label: "Grupos/listas no WhatsApp" },
  { value: "presencial", label: "Indicação presencial" },
  { value: "outro", label: "Outro" },
] as const;

export const AFFILIATE_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "kwai", label: "Kwai" },
  { value: "outra", label: "Outra" },
] as const;

export const affiliateSchema = z.object({
  fullName: trimmed(5, 120, "Nome completo").refine((v) => v.includes(" "), "Informe nome e sobrenome"),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(isValidCpf, "CPF inválido"),
  phone: phoneSchema,
  email: emailSchema,
  platform: z.enum(AFFILIATE_PLATFORMS.map((p) => p.value) as [string, ...string[]]),
  profileUrl: z
    .string()
    .trim()
    .max(300)
    .pipe(z.url({ protocol: /^https$/, message: "Use o link público completo (https://...)" })),
  followersDeclared: z.coerce
    .number({ message: "Informe a quantidade de seguidores" })
    .int()
    .min(1000, "O programa exige pelo menos 1.000 seguidores")
    .max(1_000_000_000),
  audience: trimmed(20, 1000, "Público"),
  salesForecastMonthly: z.coerce.number().int().min(1, "Informe uma previsão realista").max(100000),
  salesForecastBasis: trimmed(20, 1000, "Base da previsão"),
  strategy: trimmed(20, 2000, "Estratégia"),
  channels: z
    .array(z.enum(AFFILIATE_CHANNELS.map((c) => c.value) as [string, ...string[]]))
    .min(1, "Escolha ao menos um canal")
    .max(8),
  truthConfirmed: z.literal(true, { message: "Confirme que as informações são verdadeiras" }),
  privacyConsent: z.literal(true, { message: "É preciso aceitar o tratamento dos dados" }),
});

export type AffiliateInput = z.input<typeof affiliateSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens")
  .max(120);

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export const variantInputSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().max(60).optional().transform((v) => v || null),
  color: z.string().trim().max(40).optional().transform((v) => v || null),
  size: z.string().trim().max(20).optional().transform((v) => v || null),
  priceCents: z.number().int().min(1, "Preço obrigatório").max(10_000_000),
  compareAtCents: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
});

export const productInputSchema = z
  .object({
    id: z.uuid(),
    name: trimmed(1, 120, "Nome"),
    slug: slugSchema,
    description: z.string().trim().max(5000),
    specs: z
      .array(z.object({ label: trimmed(1, 40, "Rótulo"), value: trimmed(1, 200, "Valor") }))
      .max(12),
    categoryId: z.uuid().nullable(),
    status: z.enum(["draft", "active", "archived"]),
    isFeatured: z.boolean(),
    position: z.number().int().min(0).max(100000),
    seoTitle: z.string().trim().max(70).optional(),
    seoDescription: z.string().trim().max(160).optional(),
    variants: z.array(variantInputSchema).min(1, "Cadastre ao menos uma variante").max(60),
    images: z
      .array(
        z.object({
          storagePath: z.string().regex(/^products\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/),
          alt: z.string().trim().max(160),
          color: z.string().trim().max(40).optional().transform((v) => v || null),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
        }),
      )
      .max(12),
  })
  .superRefine((p, ctx) => {
    for (const [i, v] of p.variants.entries()) {
      if (v.compareAtCents != null && v.compareAtCents <= v.priceCents) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "compareAtCents"],
          message: "O preço \"de\" precisa ser maior que o preço de venda",
        });
      }
    }
    for (const img of p.images) {
      if (!img.storagePath.startsWith(`products/${p.id}/`)) {
        ctx.addIssue({ code: "custom", path: ["images"], message: "Imagem de outro produto" });
      }
    }
  });

export type ProductInput = z.input<typeof productInputSchema>;

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,32}$/, "Use 3 a 32 letras, números ou hífens"),
    description: z.string().trim().max(200).optional(),
    kind: z.enum(["percent", "fixed"]),
    value: z.number().int().positive(),
    minSubtotalCents: z.number().int().min(0),
    maxUses: z.number().int().positive().nullable(),
    maxUsesPerCustomer: z.number().int().positive(),
    startsAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    isActive: z.boolean(),
  })
  .refine((c) => c.kind !== "percent" || c.value <= 100, { path: ["value"], message: "Percentual máximo: 100" })
  .refine((c) => !c.expiresAt || new Date(c.expiresAt) > new Date(c.startsAt), {
    path: ["expiresAt"],
    message: "O fim precisa ser depois do início",
  });

export const shippingRateSchema = z.object({
  uf: ufSchema,
  priceCents: z.number().int().min(0).max(1_000_000),
  deliveryEstimate: z.string().trim().max(60).optional().transform((v) => v || null),
  isActive: z.boolean(),
});

export const settingsSchema = z.object({
  storeName: trimmed(1, 80, "Nome da loja"),
  contactEmail: z.union([z.literal(""), emailSchema]).transform((v) => v || null),
  whatsapp: z.union([z.literal(""), phoneSchema]).transform((v) => v || null),
  instagramUrl: z
    .union([z.literal(""), z.url({ protocol: /^https$/ })])
    .transform((v) => v || null),
  pixKey: z.string().trim().max(77).transform((v) => v || null),
  pixKeyType: z.union([z.literal(""), z.enum(["cpf", "cnpj", "email", "phone", "random"])]).transform((v) => v || null),
  pixHolderName: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9 ]{0,25}$/, "Até 25 letras sem acento")
    .transform((v) => v || null),
  pixCity: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z ]{0,15}$/, "Até 15 letras sem acento")
    .transform((v) => v || null),
  pixExpirationHours: z.coerce.number().int().min(1).max(168),
  cardEnabled: z.boolean(),
  announcement: z.string().trim().max(140).transform((v) => v || null),
  shippingPolicy: z.string().trim().max(8000).transform((v) => v || null),
  exchangePolicy: z.string().trim().max(8000).transform((v) => v || null),
});

/** Primeira mensagem legível de um ZodError. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}
