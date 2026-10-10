// Hello World
"use server";

import { errorMessage } from "@/lib/errors";
import { checkoutUrlForOrder } from "@/lib/payments";
import { allowRequest } from "@/lib/rate-limit";
import { isStripeConfigured } from "@/lib/stripe";
import { getServiceDb } from "@/lib/supabase/server";

export type ResumeResult = { ok: true; url: string } | { ok: false; message: string };

/** Abre (ou reabre) o pagamento com cartão de um pedido ainda aguardando pagamento. */
export async function resumeCardPayment(token: string): Promise<ResumeResult> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, message: errorMessage("not_found") };
  if (!isStripeConfigured()) return { ok: false, message: errorMessage("card_unavailable") };
  try {
    if (!(await allowRequest("resume-card", 10, 600))) return { ok: false, message: errorMessage("rate_limited") };
    const db = getServiceDb();
    const { data: order } = await db
      .from("orders")
      .select("id, number, public_token, total_cents, customer_email, stripe_checkout_session_id, status, payment_method")
      .eq("public_token", token)
      .maybeSingle();
    if (!order || order.payment_method !== "card" || order.status !== "awaiting_payment") {
      return { ok: false, message: errorMessage("invalid_transition") };
    }
    const { data: items } = await db.from("order_items").select("product_name, variant_label, quantity").eq("order_id", order.id);
    const summary = (items ?? [])
      .map((i) => `${i.quantity}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ""}`)
      .join(", ");
    return { ok: true, url: await checkoutUrlForOrder(order, summary) };
  } catch (err) {
    console.error("[pedido] resumeCardPayment", err);
    return { ok: false, message: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." };
  }
}
