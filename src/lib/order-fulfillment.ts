// Hello World
import "server-only";
import { formatBRL } from "@/lib/br";
import type { DimonaFiles, DimonaShippingSpeed, ShippingAddress } from "@/lib/database.types";
import {
  createDimonaOrder,
  DimonaError,
  findDimonaOrderBySellerId,
  getDimonaOrder,
  isDimonaConfigured,
} from "@/lib/dimona";
import { buildDimonaOrderPayload, dimonaOrderRef, type DimonaOrderItemInput } from "@/lib/dimona-payload";
import { notifyStore } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { PAYMENT_METHOD } from "@/lib/order-status";
import { getServiceDb } from "@/lib/supabase/server";

export type ForwardResult =
  | { status: "sent"; dimonaId: string | null }
  | { status: "already_sent"; dimonaId: string }
  | { status: "skipped" }
  | { status: "not_paid" }
  | { status: "failed"; error: string };

interface OrderForFulfillment {
  id: string;
  number: number;
  status: string;
  payment_method: "pix" | "card";
  total_cents: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_document: string | null;
  shipping_address: ShippingAddress;
  dimona_order_id: string | null;
}

async function loadOrder(orderId: string) {
  const db = getServiceDb();
  const [{ data: order }, { data: items }] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, number, status, payment_method, total_cents, customer_name, customer_email, customer_phone, customer_document, shipping_address, dimona_order_id",
      )
      .eq("id", orderId)
      .maybeSingle<OrderForFulfillment>(),
    db.from("order_items").select("product_id, variant_id, product_name, variant_label, sku, quantity").eq("order_id", orderId),
  ]);
  return { order, items: items ?? [] };
}

/** Itens do pedido que são produzidos pela Dimona, com SKU e artes já resolvidos. */
async function dimonaItemsFor(
  items: { product_id: string | null; variant_id: string | null; product_name: string; variant_label: string | null; sku: string | null; quantity: number }[],
): Promise<{ items: DimonaOrderItemInput[]; problems: string[] }> {
  const db = getServiceDb();
  const productIds = [...new Set(items.map((i) => i.product_id).filter((v): v is string => Boolean(v)))];
  const variantIds = [...new Set(items.map((i) => i.variant_id).filter((v): v is string => Boolean(v)))];
  if (productIds.length === 0) return { items: [], problems: [] };

  const [{ data: products }, { data: variants }, { data: files }] = await Promise.all([
    db.from("products").select("id, fulfillment").in("id", productIds),
    variantIds.length ? db.from("product_variants").select("id, dimona_sku_id").in("id", variantIds) : Promise.resolve({ data: [] }),
    db.from("product_dimona").select("product_id, designs, mocks").in("product_id", productIds),
  ]);

  const out: DimonaOrderItemInput[] = [];
  const problems: string[] = [];
  for (const item of items) {
    const product = products?.find((p) => p.id === item.product_id);
    if (product?.fulfillment !== "dimona") continue;
    const sku = variants?.find((v) => v.id === item.variant_id)?.dimona_sku_id ?? null;
    const art = files?.find((f) => f.product_id === item.product_id);
    const designs: DimonaFiles = art?.designs ?? {};
    if (!sku) problems.push(`${item.product_name}: variante sem SKU Dimona`);
    if (Object.keys(designs).length === 0) problems.push(`${item.product_name}: sem arte cadastrada`);
    if (!sku) continue;
    out.push({
      productName: item.product_name,
      variantLabel: item.variant_label,
      sku: item.sku,
      quantity: item.quantity,
      dimonaSkuId: sku,
      designs,
      mocks: art?.mocks ?? {},
    });
  }
  return { items: out, problems };
}

/**
 * Repassa à Dimona os itens sob demanda de um pedido pago. Idempotente: a Dimona recusa
 * pedidos repetidos (mesmo order_id) e o id dela fica gravado no pedido.
 */
export async function forwardOrderToDimona(orderId: string): Promise<ForwardResult> {
  const { order, items } = await loadOrder(orderId);
  if (!order) return { status: "failed", error: "Pedido não encontrado" };
  if (order.dimona_order_id) return { status: "already_sent", dimonaId: order.dimona_order_id };
  if (!["paid", "preparing"].includes(order.status)) return { status: "not_paid" };

  const { items: dimonaItems, problems } = await dimonaItemsFor(items);
  if (dimonaItems.length === 0 && problems.length === 0) return { status: "skipped" };

  const db = getServiceDb();
  const fail = async (error: string): Promise<ForwardResult> => {
    await db.rpc("dimona_mark_failed", { p_order_id: order.id, p_error: error });
    return { status: "failed", error };
  };
  if (problems.length > 0) return fail(`Cadastro incompleto: ${problems.join("; ")}`);
  if (!isDimonaConfigured()) return fail("DIMONA_API_KEY não configurada no servidor.");

  const { data: settings } = await db.from("store_settings").select("dimona_shipping_speed").maybeSingle();
  const speed: DimonaShippingSpeed = settings?.dimona_shipping_speed ?? "pac";
  const payload = buildDimonaOrderPayload({
    orderNumber: order.number,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    customerDocument: order.customer_document,
    address: order.shipping_address,
    shippingSpeed: speed,
    webhookUrl: siteUrl.startsWith("https://") ? `${siteUrl}/api/webhooks/dimona` : null,
    items: dimonaItems,
  });

  try {
    const created = await createDimonaOrder(payload);
    if (created.kind === "created") {
      await db.rpc("dimona_mark_sent", { p_order_id: order.id, p_dimona_id: created.dimonaId });
      return { status: "sent", dimonaId: created.dimonaId };
    }
    // Já existia (repasse anterior sem resposta): recupera o id pela lista da conta.
    const existing = await findDimonaOrderBySellerId(dimonaOrderRef(order.number)).catch(() => null);
    await db.rpc("dimona_mark_sent", {
      p_order_id: order.id,
      p_dimona_id: existing?.dimona_id ?? null,
      p_message: "Pedido já existia na Dimona; vínculo restaurado.",
    });
    return { status: "sent", dimonaId: existing?.dimona_id ?? null };
  } catch (err) {
    const message = err instanceof DimonaError ? `Dimona (${err.status}): ${err.message}` : String(err);
    console.error("[dimona] repasse", order.number, message);
    return fail(message);
  }
}

/** Consulta o status do pedido na Dimona e grava no pedido (botão do painel). */
export async function refreshDimonaStatus(orderId: string): Promise<{ ok: boolean; message: string }> {
  const { order } = await loadOrder(orderId);
  if (!order?.dimona_order_id) return { ok: false, message: "Este pedido ainda não foi enviado à Dimona." };
  const info = await getDimonaOrder(order.dimona_order_id);
  const { error } = await getServiceDb().rpc("dimona_apply_status", {
    p_dimona_id: info.dimona_id,
    p_seller_id: info.seller_id ?? dimonaOrderRef(order.number),
    p_status_id: info.status_id ?? null,
    p_status_name: info.status ?? null,
    p_tracking_url: info.tracking_url ?? null,
  });
  if (error) throw new Error(`dimona_apply_status: ${error.message}`);
  return { ok: true, message: info.status ? `Status na Dimona: ${info.status}` : "Status atualizado." };
}

function describeForward(result: ForwardResult): string {
  switch (result.status) {
    case "sent":
      return `Enviado para produção na Dimona${result.dimonaId ? ` (nº ${result.dimonaId})` : ""}. Lembre de pagar o pedido no painel da Dimona.`;
    case "already_sent":
      return `Já estava na Dimona (nº ${result.dimonaId}).`;
    case "skipped":
      return "Sem itens da Dimona: separar do estoque próprio.";
    case "not_paid":
      return "Pedido ainda não pago.";
    case "failed":
      return `FALHOU ao enviar para a Dimona: ${result.error}. Reenvie pelo painel.`;
  }
}

/**
 * Executado uma única vez quando o pedido passa a "pago" (Stripe ou Pix manual):
 * repasse automático à Dimona (se ligado no painel) e aviso por e-mail para a equipe.
 */
export async function afterOrderPaid(orderId: string): Promise<void> {
  try {
    const db = getServiceDb();
    const { data: settings } = await db.from("store_settings").select("dimona_auto_forward").maybeSingle();
    const forward: ForwardResult | null = settings?.dimona_auto_forward === false ? null : await forwardOrderToDimona(orderId);

    const { order, items } = await loadOrder(orderId);
    if (!order) return;
    await notifyStore({
      subject: `Venda paga · pedido nº ${order.number} · ${formatBRL(order.total_cents)}`,
      intro: "Pagamento confirmado na loja Maverick Capshop.",
      rows: [
        ["Pedido", `nº ${order.number}`],
        ["Total", formatBRL(order.total_cents)],
        ["Pagamento", PAYMENT_METHOD[order.payment_method]],
        ["Cliente", `${order.customer_name} · ${order.customer_email}`],
        ["Itens", items.map((i) => `${i.quantity}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ""}`).join("\n")],
        ["Entrega", `${order.shipping_address.city}/${order.shipping_address.uf}`],
        ["Dimona", forward ? describeForward(forward) : "Repasse automático desligado no painel."],
      ],
      link: { href: `${siteUrl}/admin/pedidos/${order.id}`, label: "Abrir o pedido no painel" },
      replyTo: order.customer_email,
    });
  } catch (err) {
    console.error("[pedido pago] pós-processamento", orderId, err);
  }
}
