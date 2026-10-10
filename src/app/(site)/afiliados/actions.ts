// Hello World
"use server";

import { z } from "zod";
import { errorCode, errorMessage } from "@/lib/errors";
import { allowRequest, hashedClientIp } from "@/lib/rate-limit";
import { getServiceDb, NotConfiguredError } from "@/lib/supabase/server";
import { affiliateSchema } from "@/lib/validation";

export type AffiliateResult =
  | { ok: true; statusPath: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function submitAffiliate(input: unknown): Promise<AffiliateResult> {
  const parsed = affiliateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, message: "Revise os campos destacados.", fieldErrors };
  }
  const d = parsed.data;
  try {
    if (!(await allowRequest("affiliate", 5, 3600))) return { ok: false, message: errorMessage("rate_limited") };
    const { data, error } = await getServiceDb().rpc("submit_affiliate_application", {
      p: {
        full_name: d.fullName,
        cpf: d.cpf,
        phone: d.phone,
        email: d.email,
        platform: d.platform,
        profile_url: d.profileUrl,
        followers_declared: d.followersDeclared,
        audience: d.audience,
        sales_forecast_monthly: d.salesForecastMonthly,
        sales_forecast_basis: d.salesForecastBasis,
        strategy: d.strategy,
        channels: d.channels,
        truth_confirmed: d.truthConfirmed,
        privacy_consent: d.privacyConsent,
      },
      p_ip_hash: await hashedClientIp(),
    });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    const result = z.object({ status_token: z.string().optional(), error: z.string().optional() }).parse(data);
    if (result.error) return { ok: false, message: errorMessage(result.error) };
    if (!result.status_token) return { ok: false, message: errorMessage("unknown") };
    return { ok: true, statusPath: `/afiliados/status/${result.status_token}` };
  } catch (err) {
    if (err instanceof NotConfiguredError) return { ok: false, message: errorMessage("not_configured") };
    console.error("[afiliados] submit", err);
    return { ok: false, message: errorMessage("unknown") };
  }
}

export async function respondAffiliate(token: string, message: string): Promise<{ ok: boolean; message: string }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, message: errorMessage("not_found") };
  const text = message.trim();
  if (text.length < 10 || text.length > 2000) return { ok: false, message: "Escreva entre 10 e 2.000 caracteres." };
  try {
    if (!(await allowRequest("affiliate-respond", 5, 3600))) return { ok: false, message: errorMessage("rate_limited") };
    const { error } = await getServiceDb().rpc("affiliate_respond", { p_token: token, p_message: text });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    return { ok: true, message: "Resposta enviada. Sua candidatura voltou para análise." };
  } catch (err) {
    console.error("[afiliados] respond", err);
    return { ok: false, message: errorMessage("unknown") };
  }
}
