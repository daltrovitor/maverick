// Hello World
import "server-only";
import { after } from "next/server";
import QRCode from "qrcode";
import type Stripe from "stripe";
import { buildPixPayload } from "@/lib/pix";
import { getStripe } from "@/lib/stripe";
import type { PaymentMethod, PixProvider, StoreSettingsRow } from "@/lib/database.types";
import { afterOrderPaid } from "@/lib/order-fulfillment";
import { getServiceDb } from "@/lib/supabase/server";

export interface PixInstructions {
  payload: string;
  qrSvg: string;
  key: string;
  holderName: string;
  city: string;
}

/** QR Code em SVG gerado no servidor (sem imagem externa) a partir do "copia e cola". */
export function pixQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#26170a", light: "#ffffff" },
  });
}

/** Pix manual: monta o BR Code estático e o QR Code a partir das configurações da loja. */
export async function pixInstructions(
  settings: StoreSettingsRow,
  order: { number: number; total_cents: number },
): Promise<PixInstructions | null> {
  if (!settings.pix_key || !settings.pix_holder_name || !settings.pix_city) return null;
  const payload = buildPixPayload({
    key: settings.pix_key,
    holderName: settings.pix_holder_name,
    city: settings.pix_city,
    amountCents: order.total_cents,
    txid: `MAV${order.number}`,
    description: `Pedido ${order.number}`,
  });
  return {
    payload,
    qrSvg: await pixQrSvg(payload),
    key: settings.pix_key,
    holderName: settings.pix_holder_name,
    city: settings.pix_city,
  };
}

/** Campos do pedido necessários para cobrar pelo Stripe (lidos com a service role). */
export interface PaymentOrder {
  id: string;
  number: number;
  status: string;
  payment_method: PaymentMethod;
  pix_provider: PixProvider | null;
  total_cents: number;
  customer_name: string;
  customer_email: string;
  customer_document: string | null;
  stripe_payment_intent_id: string | null;
  pix_qr_data: string | null;
  pix_qr_expires_at: string | null;
  expires_at: string | null;
}

const PAYMENT_ORDER_COLUMNS =
  "id, number, status, payment_method, pix_provider, total_cents, customer_name, customer_email, customer_document, " +
  "stripe_payment_intent_id, pix_qr_data, pix_qr_expires_at, expires_at";

export async function loadPaymentOrder(by: { id: string } | { token: string }): Promise<PaymentOrder | null> {
  const query = getServiceDb().from("orders").select(PAYMENT_ORDER_COLUMNS);
  const { data, error } = await ("id" in by ? query.eq("id", by.id) : query.eq("public_token", by.token))
    .maybeSingle<PaymentOrder>();
  if (error) throw new Error(`loadPaymentOrder: ${error.message}`);
  return data ?? null;
}

const metadataFor = (order: PaymentOrder) => ({ order_id: order.id, order_number: String(order.number) });

type Outcome = "paid" | "failed" | "canceled";

function outcomeForStatus(status: Stripe.PaymentIntent.Status): Outcome | null {
  if (status === "succeeded") return "paid";
  if (status === "canceled") return "canceled";
  return null;
}

/**
 * Aplica no banco o resultado de um PaymentIntent (webhook ou conferência direta pela
 * página do pedido). A função do banco é idempotente; a venda é processada uma única
 * vez (Dimona + aviso por e-mail) quando a transição para "pago" acontece.
 */
export async function applyPaymentIntentOutcome(
  orderId: string,
  paymentIntentId: string,
  outcome: Outcome,
  event: { id: string; type: string },
): Promise<string> {
  const { data, error } = await getServiceDb().rpc("process_payment_intent_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: orderId,
    p_payment_intent_id: paymentIntentId,
    p_outcome: outcome,
  });
  if (error) throw new Error(`process_payment_intent_event: ${error.message}`);
  if (data === "paid") after(() => afterOrderPaid(orderId));
  return data;
}

/** Confere o PaymentIntent no Stripe e aplica se já foi pago/cancelado (rede de segurança do webhook). */
export async function syncPaymentIntent(order: PaymentOrder): Promise<Stripe.PaymentIntent | null> {
  if (!order.stripe_payment_intent_id || order.status !== "awaiting_payment") return null;
  const pi = await getStripe().paymentIntents.retrieve(order.stripe_payment_intent_id);
  const outcome = outcomeForStatus(pi.status);
  if (outcome) {
    await applyPaymentIntentOutcome(order.id, pi.id, outcome, { id: `sync:${pi.id}:${pi.status}`, type: `sync.${pi.status}` });
  }
  return pi;
}

export type CardSession = { kind: "ready"; clientSecret: string } | { kind: "settled"; status: "paid" | "processing" };

/**
 * Cartão (crédito ou débito) pelo Payment Element: reaproveita o PaymentIntent aberto
 * do pedido ou cria um novo. Os dados do cartão vão direto do navegador ao Stripe.
 */
export async function ensureCardSession(order: PaymentOrder): Promise<CardSession> {
  if (order.payment_method !== "card" || order.status !== "awaiting_payment") throw new Error("pedido não aguarda cartão");
  const stripe = getStripe();

  if (order.stripe_payment_intent_id) {
    const pi = await syncPaymentIntent(order);
    if (pi?.status === "succeeded") return { kind: "settled", status: "paid" };
    if (pi?.status === "processing") return { kind: "settled", status: "processing" };
    if (pi && pi.status !== "canceled" && pi.amount === order.total_cents && pi.client_secret) {
      return { kind: "ready", clientSecret: pi.client_secret };
    }
  }

  const pi = await stripe.paymentIntents.create(
    {
      amount: order.total_cents,
      currency: "brl",
      payment_method_types: ["card"],
      description: `Maverick Capshop · pedido ${order.number}`,
      receipt_email: order.customer_email,
      metadata: metadataFor(order),
    },
    // Clique duplo ou recarga simultânea devolvem o mesmo PaymentIntent.
    { idempotencyKey: `card:${order.id}:${order.stripe_payment_intent_id ?? "initial"}` },
  );
  const { error } = await getServiceDb().rpc("attach_payment_intent", { p_order_id: order.id, p_payment_intent_id: pi.id });
  if (error) throw new Error(`attach_payment_intent: ${error.message}`);
  if (!pi.client_secret) throw new Error("Stripe não retornou o client_secret");
  return { kind: "ready", clientSecret: pi.client_secret };
}

export interface StripePixCharge {
  data: string;
  expiresAt: string | null;
}

/**
 * Pix pelo Stripe: cria e confirma no servidor um PaymentIntent Pix com o valor exato do
 * pedido e devolve o "copia e cola" (o QR é desenhado pela loja). O pagamento é confirmado
 * automaticamente pelo webhook payment_intent.succeeded.
 */
export async function ensureStripePix(order: PaymentOrder): Promise<StripePixCharge | null> {
  if (order.payment_method !== "pix" || order.pix_provider !== "stripe" || order.status !== "awaiting_payment") return null;
  if (order.pix_qr_data) return { data: order.pix_qr_data, expiresAt: order.pix_qr_expires_at };
  const stripe = getStripe();

  let pi: Stripe.PaymentIntent | null = null;
  if (order.stripe_payment_intent_id) {
    pi = await syncPaymentIntent(order);
    if (pi?.status === "succeeded" || pi?.status === "canceled") return null;
  }

  if (!pi?.next_action?.pix_display_qr_code?.data) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const orderDeadline = order.expires_at ? Math.floor(new Date(order.expires_at).getTime() / 1000) : nowSeconds + 86_400;
    // Limites do Stripe: entre 10 s e 14 dias a partir de agora.
    const expiresAt = Math.min(Math.max(orderDeadline, nowSeconds + 300), nowSeconds + 1_209_000);
    pi = await stripe.paymentIntents.create(
      {
        amount: order.total_cents,
        currency: "brl",
        payment_method_types: ["pix"],
        payment_method_data: {
          type: "pix",
          billing_details: {
            name: order.customer_name,
            email: order.customer_email,
            ...(order.customer_document ? { tax_id: order.customer_document } : {}),
          },
        },
        payment_method_options: { pix: { expires_at: expiresAt } },
        confirm: true,
        description: `Maverick Capshop · pedido ${order.number}`,
        metadata: metadataFor(order),
      },
      { idempotencyKey: `pix:${order.id}:${order.stripe_payment_intent_id ?? "initial"}` },
    );
  }

  const qr = pi.next_action?.pix_display_qr_code;
  if (!qr?.data) throw new Error(`Stripe não retornou o QR Code do Pix (status ${pi.status})`);
  const expiresAtIso = qr.expires_at ? new Date(qr.expires_at * 1000).toISOString() : null;
  const { error } = await getServiceDb().rpc("attach_payment_intent", {
    p_order_id: order.id,
    p_payment_intent_id: pi.id,
    p_pix_qr_data: qr.data,
    p_pix_qr_expires_at: expiresAtIso,
  });
  if (error) throw new Error(`attach_payment_intent: ${error.message}`);
  return { data: qr.data, expiresAt: expiresAtIso };
}
