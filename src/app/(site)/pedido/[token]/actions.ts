// Hello World
"use server";

import { errorMessage } from "@/lib/errors";
import { ensureCardSession, loadPaymentOrder, syncPaymentIntent } from "@/lib/payments";
import { allowRequest } from "@/lib/rate-limit";
import { isStripeConfigured } from "@/lib/stripe";

const TOKEN = /^[0-9a-f]{64}$/;

export type CardStartResult =
  | { ok: true; clientSecret: string }
  | { ok: true; settled: "paid" | "processing" }
  | { ok: false; message: string };

/** Abre (ou reabre) o pagamento com cartão do pedido: devolve o client_secret do PaymentIntent. */
export async function startCardPayment(token: string): Promise<CardStartResult> {
  if (!TOKEN.test(token)) return { ok: false, message: errorMessage("not_found") };
  if (!isStripeConfigured()) return { ok: false, message: errorMessage("card_unavailable") };
  try {
    if (!(await allowRequest("card-start", 20, 600))) return { ok: false, message: errorMessage("rate_limited") };
    const order = await loadPaymentOrder({ token });
    if (!order || order.payment_method !== "card" || order.status !== "awaiting_payment") {
      return { ok: false, message: errorMessage("invalid_transition") };
    }
    const session = await ensureCardSession(order);
    return session.kind === "ready" ? { ok: true, clientSecret: session.clientSecret } : { ok: true, settled: session.status };
  } catch (err) {
    console.error("[pedido] startCardPayment", err);
    return { ok: false, message: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." };
  }
}

/**
 * Depois do confirmPayment no navegador: confere o PaymentIntent direto no Stripe para
 * a página refletir o pagamento sem esperar o webhook (que continua sendo a fonte oficial).
 */
export async function confirmCardReturn(token: string): Promise<{ status: "paid" | "processing" | "pending" }> {
  if (!TOKEN.test(token) || !isStripeConfigured()) return { status: "pending" };
  try {
    const order = await loadPaymentOrder({ token });
    if (!order) return { status: "pending" };
    const pi = await syncPaymentIntent(order);
    if (pi?.status === "succeeded") return { status: "paid" };
    if (pi?.status === "processing") return { status: "processing" };
    return { status: "pending" };
  } catch (err) {
    console.error("[pedido] confirmCardReturn", err);
    return { status: "pending" };
  }
}
