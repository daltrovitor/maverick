// Hello World
import "server-only";
import Stripe from "stripe";
import { publicEnv, serverEnv } from "@/lib/env";
import { NotConfiguredError } from "@/lib/supabase/server";

let client: Stripe | null = null;

/** Secreta + webhook (confirmação) + publicável (Payment Element no navegador). */
export function isStripeConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/** Cliente oficial do Stripe (somente servidor; a chave secreta nunca vai ao navegador). */
export function getStripe(): Stripe {
  const key = serverEnv().STRIPE_SECRET_KEY;
  if (!key) throw new NotConfiguredError("Stripe");
  client ??= new Stripe(key, {
    appInfo: { name: "Maverick Capshop", url: "https://maverick.viraweb.dev.br" },
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  return client;
}

export type StripeOutcome = "paid" | "failed" | "expired";

/**
 * Eventos do PaymentIntent (Payment Element: cartão e Pix dentro do site).
 * payment_failed no cartão é só uma tentativa recusada; no Pix, o QR Code expirou.
 */
export function paymentIntentOutcome(event: Stripe.Event): {
  outcome: "paid" | "failed" | "canceled";
  intent: Stripe.PaymentIntent;
} | null {
  switch (event.type) {
    case "payment_intent.succeeded":
      return { outcome: "paid", intent: event.data.object };
    case "payment_intent.payment_failed":
      return { outcome: "failed", intent: event.data.object };
    case "payment_intent.canceled":
      return { outcome: "canceled", intent: event.data.object };
    default:
      return null;
  }
}

/**
 * Pedidos antigos (Stripe Checkout por redirecionamento): converte um evento verificado em
 * resultado de negócio. Eventos irrelevantes retornam null.
 * checkout.session.completed com pagamento ainda "unpaid" (métodos assíncronos) aguarda o
 * evento async_payment_* seguinte.
 */
export function outcomeForEvent(event: Stripe.Event): {
  outcome: StripeOutcome;
  session: Stripe.Checkout.Session;
} | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      return session.payment_status === "paid" ? { outcome: "paid", session } : null;
    }
    case "checkout.session.async_payment_succeeded":
      return { outcome: "paid", session: event.data.object };
    case "checkout.session.async_payment_failed":
      return { outcome: "failed", session: event.data.object };
    case "checkout.session.expired":
      return { outcome: "expired", session: event.data.object };
    default:
      return null;
  }
}
