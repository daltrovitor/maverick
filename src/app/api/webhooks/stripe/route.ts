// Hello World
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { getStripe, outcomeForEvent } from "@/lib/stripe";
import { getServiceDb } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Webhook do Stripe. A assinatura é verificada sobre o corpo bruto; cada evento é aplicado
 * uma única vez (stripe_events) dentro de uma transação no banco.
 * Respostas 2xx encerram as tentativas do Stripe; 5xx pedem nova entrega.
 */
export async function POST(request: Request) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "webhook não configurado" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "assinatura inválida" }, { status: 400 });
  }

  const result = outcomeForEvent(event);
  if (!result) return NextResponse.json({ received: true, ignored: event.type });

  const orderId = result.session.metadata?.order_id ?? result.session.client_reference_id ?? "";
  if (!UUID.test(orderId)) {
    return NextResponse.json({ received: true, ignored: "sem pedido associado" });
  }

  const paymentIntent =
    typeof result.session.payment_intent === "string"
      ? result.session.payment_intent
      : (result.session.payment_intent?.id ?? null);

  const { data, error } = await getServiceDb().rpc("process_stripe_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: orderId,
    p_session_id: result.session.id,
    p_payment_intent_id: paymentIntent,
    p_outcome: result.outcome,
  });

  if (error) {
    console.error("[stripe-webhook]", event.id, error.message);
    return NextResponse.json({ error: "falha ao registrar" }, { status: 500 });
  }
  return NextResponse.json({ received: true, result: data });
}
