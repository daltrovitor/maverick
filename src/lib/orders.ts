// Hello World
import "server-only";
import { z } from "zod";
import { getPublicDb } from "@/lib/supabase/server";

const orderViewSchema = z.object({
  id: z.uuid(),
  number: z.number(),
  status: z.enum(["awaiting_payment", "paid", "preparing", "shipped", "delivered", "canceled", "expired"]),
  payment_method: z.enum(["pix", "card"]),
  payment_status: z.string(),
  // nullish: tolera o banco ainda sem a migration 07 durante o deploy.
  pix_provider: z.enum(["stripe", "manual"]).nullish(),
  pix_qr_data: z.string().nullish(),
  pix_qr_expires_at: z.string().nullish(),
  delivery_tracking_url: z.string().nullish(),
  customer_name: z.string(),
  customer_email: z.string(),
  shipping_address: z.object({
    cep: z.string(),
    street: z.string(),
    number: z.string(),
    complement: z.string().nullable().optional(),
    district: z.string(),
    city: z.string(),
    uf: z.string(),
  }),
  shipping_cents: z.number(),
  shipping_estimate: z.string().nullable(),
  subtotal_cents: z.number(),
  discount_cents: z.number(),
  total_cents: z.number(),
  coupon_code: z.string().nullable(),
  tracking_code: z.string().nullable(),
  expires_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  server_now: z.string(),
  items: z.array(
    z.object({
      product_name: z.string(),
      variant_label: z.string().nullable(),
      image_path: z.string().nullable(),
      unit_price_cents: z.number(),
      quantity: z.number(),
      total_cents: z.number(),
    }),
  ),
  events: z.array(z.object({ type: z.string(), to_status: z.string().nullable(), created_at: z.string() })),
});

export type OrderView = z.infer<typeof orderViewSchema>;

/** Pedido pelo link secreto (função do banco valida o formato do token). */
export async function getOrderByToken(token: string): Promise<OrderView | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const db = getPublicDb();
  if (!db) return null;
  const { data, error } = await db.rpc("get_order_by_token", { p_token: token });
  if (error || !data) return null;
  const parsed = orderViewSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[orders] formato inesperado", parsed.error.issues[0]);
    return null;
  }
  return parsed.data;
}
