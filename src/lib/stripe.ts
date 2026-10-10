// Hello World
import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { NotConfiguredError } from "@/lib/supabase/server";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
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
 * Converte um evento verificado em resultado de negócio. Eventos irrelevantes retornam null.
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
