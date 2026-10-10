// Hello World
"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ufName } from "@/lib/br";
import { errorCode, errorMessage } from "@/lib/errors";
import { checkoutUrlForOrder } from "@/lib/payments";
import { allowRequest } from "@/lib/rate-limit";
import { isStripeConfigured } from "@/lib/stripe";
import { getServiceDb, NotConfiguredError } from "@/lib/supabase/server";
import { checkoutSchema, firstIssue, quoteSchema } from "@/lib/validation";

export interface QuoteResult {
  ok: true;
  subtotalCents: number;
  shippingCents: number;
  shippingEstimate: string | null;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
}

export type ActionError = { ok: false; code: string; message: string; field?: string };

const quoteResponse = z.object({
  subtotal_cents: z.number(),
  shipping_cents: z.number(),
  shipping_estimate: z.string().nullable(),
  discount_cents: z.number(),
  total_cents: z.number(),
  coupon_code: z.string().nullable(),
});

function fail(code: string, field?: string): ActionError {
  return { ok: false, code, message: errorMessage(code), field };
}

/** Prévia de frete, desconto e total — sempre calculada pelo banco. */
export async function quoteCheckout(input: unknown): Promise<QuoteResult | ActionError> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid_input", message: firstIssue(parsed.error) };
  try {
    if (!(await allowRequest("quote", 90, 600))) return fail("rate_limited");
    const { items, uf, couponCode, email } = parsed.data;
    const { data, error } = await getServiceDb().rpc("quote_order", {
      p: {
        items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        uf,
        coupon_code: couponCode || null,
        email: email || null,
      },
    });
    if (error) {
      const code = errorCode(error);
      if (code === "shipping_unavailable") {
        return { ok: false, code, message: `Ainda não entregamos em ${ufName(uf)}. Fale com a gente pelo WhatsApp.` };
      }
      return fail(code, code.startsWith("coupon") ? "coupon" : undefined);
    }
    const q = quoteResponse.parse(data);
    return {
      ok: true,
      subtotalCents: q.subtotal_cents,
      shippingCents: q.shipping_cents,
      shippingEstimate: q.shipping_estimate,
      discountCents: q.discount_cents,
      totalCents: q.total_cents,
      couponCode: q.coupon_code,
    };
  } catch (err) {
    if (err instanceof NotConfiguredError) return fail("not_configured");
    console.error("[checkout] quote", err);
    return fail("unknown");
  }
}

/** Confirma no ViaCEP que o CEP pertence à UF escolhida (o frete depende da UF). */
async function verifyCep(cep: string, uf: string): Promise<"ok" | "mismatch" | "not_found" | "unavailable"> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });
    if (!res.ok) return "unavailable";
    const body: unknown = await res.json();
    const data = z.object({ uf: z.string().optional(), erro: z.union([z.boolean(), z.string()]).optional() }).safeParse(body);
    if (!data.success) return "unavailable";
    if (data.data.erro) return "not_found";
    return data.data.uf?.toUpperCase() === uf ? "ok" : "mismatch";
  } catch {
    return "unavailable";
  }
}

const orderResponse = z.object({
  id: z.uuid(),
  number: z.number(),
  public_token: z.string(),
  total_cents: z.number(),
  payment_method: z.enum(["pix", "card"]),
  status: z.string(),
  replayed: z.boolean(),
});

export type PlaceOrderResult = { ok: true; redirectTo: string; external: boolean } | ActionError;

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, code: "invalid_input", message: issue?.message ?? "Dados inválidos", field: issue?.path.join(".") };
  }
  const data = parsed.data;

  try {
    if (!(await allowRequest("checkout", 12, 600))) return fail("rate_limited");
    if (data.paymentMethod === "card" && !isStripeConfigured()) return fail("card_unavailable");

    const cep = await verifyCep(data.address.cep, data.address.uf);
    if (cep === "not_found") return { ok: false, code: "invalid_input", message: "CEP não encontrado.", field: "address.cep" };
    if (cep === "mismatch") {
      return {
        ok: false,
        code: "invalid_input",
        message: "O CEP não corresponde ao estado selecionado. Confira o endereço.",
        field: "address.uf",
      };
    }

    const user = await getCurrentUser();
    const db = getServiceDb();
    // Devolve ao estoque reservas vencidas antes de reservar de novo (o cron diário é só a rede de segurança).
    const expired = await db.rpc("expire_stale_orders");
    if (expired.error) console.error("[checkout] expire_stale_orders", expired.error.message);

    const { data: created, error } = await db.rpc("create_order", {
      p: {
        idempotency_key: data.idempotencyKey,
        payment_method: data.paymentMethod,
        customer: data.customer,
        address: { ...data.address, complement: data.address.complement ?? "" },
        items: data.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
        coupon_code: data.couponCode ?? null,
        notes: data.notes ?? "",
        cep_verified: cep === "ok",
      },
      p_user_id: user?.id ?? null,
    });
    if (error) {
      const code = errorCode(error);
      if (code === "unknown") console.error("[checkout] create_order", error);
      return fail(code, code.startsWith("coupon") ? "coupon" : undefined);
    }
    const order = orderResponse.parse(created);
    const orderPath = `/pedido/${order.public_token}`;

    if (order.payment_method === "pix") return { ok: true, redirectTo: orderPath, external: false };

    // Cartão: sessão do Stripe. Se falhar, o pedido segue aguardando e pode ser pago pela página do pedido.
    try {
      const { data: full } = await db
        .from("orders")
        .select("id, number, public_token, total_cents, customer_email, stripe_checkout_session_id")
        .eq("id", order.id)
        .single();
      const { data: items } = await db.from("order_items").select("product_name, variant_label, quantity").eq("order_id", order.id);
      if (!full) throw new Error("pedido não encontrado após criação");
      const summary = (items ?? [])
        .map((i) => `${i.quantity}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ""}`)
        .join(", ");
      const url = await checkoutUrlForOrder(full, summary);
      return { ok: true, redirectTo: url, external: true };
    } catch (err) {
      console.error("[checkout] stripe session", err);
      return { ok: true, redirectTo: `${orderPath}?pagamento=indisponivel`, external: false };
    }
  } catch (err) {
    if (err instanceof NotConfiguredError) return fail("not_configured");
    console.error("[checkout] placeOrder", err);
    return fail("unknown");
  }
}
