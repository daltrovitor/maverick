// Hello World
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/lib/auth";
import { errorCode, errorMessage } from "@/lib/errors";
import type { AdminResult } from "@/app/admin/actions/orders";

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["new", "quoted", "approved", "in_production", "done", "canceled"]),
  notes: z.string().trim().max(2000),
});

/** Andamento do pedido personalizado (status + anotações internas). */
export async function updateCustomRequest(input: unknown): Promise<AdminResult> {
  try {
    const { db, user } = await requireAdmin("action");
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: errorMessage("invalid_input") };
    const { error } = await db
      .from("custom_cap_requests")
      .update({ status: parsed.data.status, admin_notes: parsed.data.notes || null, updated_by: user.id })
      .eq("id", parsed.data.id);
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/personalizados");
    revalidatePath(`/admin/personalizados/${parsed.data.id}`);
    return { ok: true, message: "Pedido personalizado atualizado." };
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: errorMessage("forbidden") };
    console.error("[admin/personalizados]", err);
    return { ok: false, message: errorMessage("unknown") };
  }
}
