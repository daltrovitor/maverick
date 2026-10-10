// Hello World
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/lib/auth";
import { errorCode, errorMessage } from "@/lib/errors";
import { couponInputSchema, firstIssue, settingsSchema, shippingRateSchema } from "@/lib/validation";
import type { AdminResult } from "@/app/admin/actions/orders";

async function guarded(fn: () => Promise<AdminResult>): Promise<AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: errorMessage("forbidden") };
    console.error("[admin/store]", err);
    return { ok: false, message: errorMessage("unknown") };
  }
}

/** Salva a tabela de frete: UFs com regra são gravadas; as demais ficam sem atendimento. */
export async function saveShippingRates(input: unknown): Promise<AdminResult> {
  return guarded(async () => {
    const { db, user } = await requireAdmin("action");
    const parsed = z.array(shippingRateSchema).max(27).safeParse(input);
    if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
    const rows = parsed.data.map((r) => ({
      uf: r.uf,
      price_cents: r.priceCents,
      delivery_estimate: r.deliveryEstimate,
      is_active: r.isActive,
      updated_by: user.id,
    }));
    const keep = rows.map((r) => r.uf);
    if (rows.length > 0) {
      const { error } = await db.from("shipping_rates").upsert(rows, { onConflict: "uf" });
      if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    }
    const del = db.from("shipping_rates").delete();
    const { error: delError } = keep.length > 0 ? await del.not("uf", "in", `(${keep.join(",")})`) : await del.neq("uf", "");
    if (delError) return { ok: false, message: errorMessage(errorCode(delError)) };
    revalidatePath("/admin/frete");
    revalidatePath("/loja");
    return { ok: true, message: "Tabela de frete salva. Pedidos já feitos mantêm o frete da época." };
  });
}

export async function saveCoupon(input: unknown, couponId?: string): Promise<AdminResult> {
  return guarded(async () => {
    const { db, user } = await requireAdmin("action");
    const parsed = couponInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
    const c = parsed.data;
    const row = {
      code: c.code,
      description: c.description || null,
      kind: c.kind,
      value: c.value,
      min_subtotal_cents: c.minSubtotalCents,
      max_uses: c.maxUses,
      max_uses_per_customer: c.maxUsesPerCustomer,
      starts_at: c.startsAt,
      expires_at: c.expiresAt,
      is_active: c.isActive,
    };
    const { error } = couponId
      ? await db.from("coupons").update(row).eq("id", z.uuid().parse(couponId))
      : await db.from("coupons").insert({ ...row, created_by: user.id });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/cupons");
    return { ok: true, message: "Cupom salvo." };
  });
}

export async function toggleCoupon(couponId: string, isActive: boolean): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const { error } = await db.from("coupons").update({ is_active: isActive }).eq("id", z.uuid().parse(couponId));
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/cupons");
    return { ok: true, message: isActive ? "Cupom ativado." : "Cupom desativado." };
  });
}

export async function saveSettings(input: unknown): Promise<AdminResult> {
  return guarded(async () => {
    const { db, user } = await requireAdmin("action");
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
    const s = parsed.data;
    const pixParts = [s.pixKey, s.pixKeyType, s.pixHolderName, s.pixCity].filter(Boolean).length;
    if (pixParts > 0 && pixParts < 4) {
      return { ok: false, message: "Para ativar o Pix, preencha chave, tipo, nome do favorecido e cidade." };
    }
    const { error } = await db
      .from("store_settings")
      .update({
        store_name: s.storeName,
        contact_email: s.contactEmail,
        whatsapp: s.whatsapp,
        instagram_url: s.instagramUrl,
        pix_key: s.pixKey,
        pix_key_type: s.pixKeyType,
        pix_holder_name: s.pixHolderName,
        pix_city: s.pixCity,
        pix_expiration_hours: s.pixExpirationHours,
        card_enabled: s.cardEnabled,
        announcement: s.announcement,
        shipping_policy: s.shippingPolicy,
        exchange_policy: s.exchangePolicy,
        updated_by: user.id,
      })
      .eq("id", true);
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/", "layout");
    return { ok: true, message: "Configurações salvas." };
  });
}

const idSchema = z.uuid();

export async function approveAffiliate(id: string, followersVerified: number, notes: string): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    if (!Number.isInteger(followersVerified) || followersVerified < 1000) {
      return { ok: false, message: "Informe os seguidores conferidos no perfil (mínimo 1.000)." };
    }
    const { data, error } = await db.rpc("admin_approve_affiliate", {
      p_id: idSchema.parse(id),
      p_followers_verified: followersVerified,
      p_notes: notes.trim() || null,
    });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    const code = z.object({ code: z.string() }).safeParse(data);
    revalidatePath("/admin/afiliados");
    return { ok: true, message: code.success ? `Aprovado. Código ${code.data.code} válido por 24h.` : "Aprovado." };
  });
}

export async function rejectAffiliate(id: string, notes: string): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const { error } = await db.rpc("admin_reject_affiliate", { p_id: idSchema.parse(id), p_notes: notes.trim() });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/afiliados");
    return { ok: true, message: "Candidatura recusada." };
  });
}

export async function requestAffiliateInfo(id: string, message: string): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const { error } = await db.rpc("admin_request_affiliate_info", { p_id: idSchema.parse(id), p_message: message.trim() });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/afiliados");
    return { ok: true, message: "Pedido de informações registrado. O candidato vê a mensagem no link de acompanhamento." };
  });
}
