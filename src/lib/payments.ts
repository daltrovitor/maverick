// Hello World
import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";
import { buildPixPayload } from "@/lib/pix";
import { getStripe } from "@/lib/stripe";
import type { StoreSettingsRow } from "@/lib/database.types";
import { getServiceDb } from "@/lib/supabase/server";

export interface PixInstructions {
  payload: string;
  qrSvg: string;
  key: string;
  holderName: string;
  city: string;
}

/** Monta o "copia e cola" e o QR Code do Pix a partir das configurações da loja. */
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
  const qrSvg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#26170a", light: "#ffffff" },
  });
  return { payload, qrSvg, key: settings.pix_key, holderName: settings.pix_holder_name, city: settings.pix_city };
}

interface CardOrder {
  id: string;
  number: number;
  public_token: string;
  total_cents: number;
  customer_email: string;
  stripe_checkout_session_id: string | null;
}

/**
 * Cria (ou reaproveita, se ainda aberta) a sessão do Stripe Checkout para um pedido com
 * cartão. Dados do cartão ficam 100% no Stripe; o banco guarda apenas o id da sessão.
 */
export async function checkoutUrlForOrder(order: CardOrder, itemsSummary: string): Promise<string> {
  const stripe = getStripe();

  if (order.stripe_checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
    if (existing.status === "open" && existing.url) return existing.url;
    if (existing.status === "complete") return `${siteUrl}/pedido/${order.public_token}?pagamento=retorno`;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      locale: "pt-BR",
      customer_email: order.customer_email,
      client_reference_id: order.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: order.total_cents,
            product_data: {
              name: `Pedido Maverick nº ${order.number}`,
              description: itemsSummary.slice(0, 480) || undefined,
            },
          },
        },
      ],
      metadata: { order_id: order.id, order_number: String(order.number) },
      payment_intent_data: {
        description: `Maverick Capshop · pedido ${order.number}`,
        metadata: { order_id: order.id, order_number: String(order.number) },
      },
      success_url: `${siteUrl}/pedido/${order.public_token}?pagamento=retorno`,
      cancel_url: `${siteUrl}/pedido/${order.public_token}?pagamento=cancelado`,
      expires_at: expiresAt,
    },
    // Reenvio da mesma requisição (clique duplo, rede instável) devolve a mesma sessão.
    { idempotencyKey: `checkout:${order.id}:${order.stripe_checkout_session_id ?? "initial"}` },
  );

  if (!session.url) throw new Error("Stripe não retornou a URL do checkout");

  const { error } = await getServiceDb().rpc("attach_stripe_session", {
    p_order_id: order.id,
    p_session_id: session.id,
    p_session_expires_at: new Date(expiresAt * 1000).toISOString(),
  });
  if (error) throw new Error(`attach_stripe_session: ${error.message}`);
  return session.url;
}
