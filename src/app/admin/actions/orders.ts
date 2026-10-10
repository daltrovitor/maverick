// Hello World
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/lib/auth";
import { errorCode, errorMessage } from "@/lib/errors";

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
    const { error } = await db.rpc("admin_confirm_pix", { p_order_id: id.parse(orderId), p_note: note.trim() || null });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
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
    const { error } = await db.rpc("admin_set_order_status", {
      p_order_id: id.parse(orderId),
      p_status: parsed.data,
      p_tracking_code: tracking.trim().slice(0, 60) || null,
      p_note: note.trim().slice(0, 1000) || null,
    });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true, message: "Status atualizado." };
  });
}
