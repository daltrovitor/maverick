// Hello World
"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/lib/auth";
import { DimonaError } from "@/lib/dimona";
import { errorCode, errorMessage } from "@/lib/errors";
import { afterOrderPaid, forwardOrderToDimona, refreshDimonaStatus } from "@/lib/order-fulfillment";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export type AdminResult = { ok: true; message: string } | { ok: false; message: string };

async function run(fn: () => Promise<AdminResult>): Promise<AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: errorMessage("forbidden") };
    console.error("[admin/orders]", err);
    return { ok: false, message: errorMessage("unknown") };
  }
}

const id = z.uuid();

export async function confirmPix(orderId: string, note: string): Promise<AdminResult> {
  return run(async () => {
    const { db } = await requireAdmin("action");
    const orderUuid = id.parse(orderId);
    const { error } = await db.rpc("admin_confirm_pix", { p_order_id: orderUuid, p_note: note.trim() || null });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    // Venda paga: repasse à Dimona (se houver itens dela) e aviso por e-mail, depois da resposta.
    after(() => afterOrderPaid(orderUuid));
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, message: "Pagamento Pix confirmado." };
  });
}

export async function rejectPix(orderId: string, reason: string): Promise<AdminResult> {
  return run(async () => {
    const { db } = await requireAdmin("action");
    if (reason.trim().length < 3) return { ok: false, message: "Informe o motivo da recusa." };
    const { error } = await db.rpc("admin_reject_pix", { p_order_id: id.parse(orderId), p_reason: reason.trim() });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, message: "Pagamento recusado e estoque devolvido." };
  });
}

const statusSchema = z.enum(["preparing", "shipped", "delivered", "canceled"]);

export async function setOrderStatus(orderId: string, status: string, tracking: string, note: string): Promise<AdminResult> {
  return run(async () => {
    const { db } = await requireAdmin("action");
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, message: errorMessage("invalid_input") };
    const orderUuid = id.parse(orderId);
    const { data: before } = await db
      .from("orders")
      .select("status, stripe_payment_intent_id")
      .eq("id", orderUuid)
      .maybeSingle();
    const { error } = await db.rpc("admin_set_order_status", {
      p_order_id: orderUuid,
      p_status: parsed.data,
      p_tracking_code: tracking.trim().slice(0, 60) || null,
      p_note: note.trim().slice(0, 1000) || null,
    });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    // Pedido cancelado antes do pagamento: encerra a cobrança aberta (QR do Pix ou cartão) no Stripe.
    if (parsed.data === "canceled" && before?.status === "awaiting_payment" && before.stripe_payment_intent_id && isStripeConfigured()) {
      await getStripe()
        .paymentIntents.cancel(before.stripe_payment_intent_id)
        .catch((err: unknown) => console.error("[admin/orders] cancelar PaymentIntent", err));
    }
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, message: "Status atualizado." };
  });
}

/** Envia (ou reenvia, após corrigir o cadastro) os itens Dimona de um pedido pago. */
export async function sendOrderToDimona(orderId: string): Promise<AdminResult> {
  return run(async () => {
    await requireAdmin("action");
    const result = await forwardOrderToDimona(id.parse(orderId));
    revalidatePath(`/admin/pedidos/${orderId}`);
    switch (result.status) {
      case "sent":
        return { ok: true, message: `Pedido enviado à Dimona${result.dimonaId ? ` (nº ${result.dimonaId})` : ""}. Pague-o no painel da Dimona.` };
      case "already_sent":
        return { ok: true, message: `Este pedido já está na Dimona (nº ${result.dimonaId}).` };
      case "skipped":
        return { ok: false, message: "Nenhum item deste pedido é produzido pela Dimona." };
      case "not_paid":
        return { ok: false, message: "Só pedidos pagos (ou em separação) vão para a Dimona." };
      case "failed":
        return { ok: false, message: result.error };
    }
  });
}

export async function refreshOrderDimona(orderId: string): Promise<AdminResult> {
  return run(async () => {
    await requireAdmin("action");
    try {
      const result = await refreshDimonaStatus(id.parse(orderId));
      revalidatePath(`/admin/pedidos/${orderId}`);
      return result;
    } catch (err) {
      if (err instanceof DimonaError) return { ok: false, message: `Dimona (${err.status}): ${err.message}` };
      throw err;
    }
  });
}
