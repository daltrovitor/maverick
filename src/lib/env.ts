// Hello World
import { z } from "zod";

/**
 * Variáveis de ambiente validadas. As públicas (NEXT_PUBLIC_*) entram no bundle do cliente;
 * as secretas só existem no servidor. Ausência de configuração nunca derruba o build:
 * cada recurso informa "não configurado" e a interface trata o estado.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  // Chave publicável do Stripe: monta o Payment Element (cartão e Pix) dentro do site.
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^pk_(test|live)_/, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY deve começar com pk_test_/pk_live_")
    .optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^(sk|rk)_(test|live)_/, "STRIPE_SECRET_KEY deve começar com sk_test_/sk_live_")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  // Sal do hash de IP usado no rate limit e na trilha de afiliados (LGPD: IP nunca é salvo puro).
  IP_HASH_SALT: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  MESHY_API_KEY: z.string().min(10).optional(),
  // Dimona (impressão sob demanda): chave da conta em camisadimona.com.br.
  DIMONA_API_KEY: z.string().min(8).optional(),
  DIMONA_API_BASE_URL: z.url().default("https://admin.camisadimona.com.br"),
  // Avisos por e-mail (Resend): pedidos personalizados e vendas pagas chegam à equipe.
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  NOTIFY_EMAIL_TO: z.email().default("viraweb.online@gmail.com"),
  EMAIL_FROM: z.string().min(3).default("Maverick Capshop <onboarding@resend.dev>"),
});

function blankToUndefined(source: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(source).map(([k, v]) => [k, v === "" ? undefined : v]));
}

export const publicEnv = publicSchema.parse(
  blankToUndefined({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  }),
);

export function serverEnv() {
  return serverSchema.parse(
    blankToUndefined({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      IP_HASH_SALT: process.env.IP_HASH_SALT,
      CRON_SECRET: process.env.CRON_SECRET,
      MESHY_API_KEY: process.env.MESHY_API_KEY,
      DIMONA_API_KEY: process.env.DIMONA_API_KEY,
      DIMONA_API_BASE_URL: process.env.DIMONA_API_BASE_URL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      NOTIFY_EMAIL_TO: process.env.NOTIFY_EMAIL_TO,
      EMAIL_FROM: process.env.EMAIL_FROM,
    }),
  );
}

export const isSupabaseConfigured = Boolean(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
