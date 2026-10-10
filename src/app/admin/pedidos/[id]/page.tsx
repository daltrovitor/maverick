// Hello World
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/admin/OrderActions";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatBRL, formatBrPhone, formatCep } from "@/lib/br";
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/order-status";
import { siteUrl } from "@/lib/env";

export const metadata = { title: "Pedido" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });

const EVENT: Record<string, string> = {
  created: "Pedido criado",
  pix_confirmed: "Pix confirmado",
  pix_rejected: "Pix recusado",
  card_paid: "Cartão aprovado (Stripe)",
  card_failed: "Cartão não concluído (Stripe)",
  status_changed: "Status alterado",
  expired: "Expirado automaticamente",
  stock_conflict: "Pago sem estoque — avaliar reembolso",
  note: "Observação",
};

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireAdmin();
  const [{ data: order }, { data: items }, { data: events }] = await Promise.all([
    db.from("orders").select("*").eq("id", id).maybeSingle(),
    db.from("order_items").select("*").eq("order_id", id),
    db.from("order_events").select("*").eq("order_id", id).order("created_at"),
  ]);
  if (!order) notFound();

  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id).filter((v): v is string => Boolean(v)))];
  const { data: actors } = actorIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", actorIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const actorName = (actorId: string | null) => {
    const a = actors?.find((x) => x.id === actorId);
    return a ? (a.full_name ?? a.email) : null;
  };
  const status = ORDER_STATUS[order.status];
  const addr = order.shipping_address;

  return (
    <div>
      <AdminHeader
        title={`Pedido nº ${order.number}`}
        description={`Criado em ${DATE.format(new Date(order.created_at))}`}
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge>{`${PAYMENT_METHOD[order.payment_method]} · ${PAYMENT_STATUS[order.payment_status]}`}</Badge>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Panel title="Itens">
            <ul className="divide-y divide-line text-sm">
              {(items ?? []).map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2">
                  <span>
                    {i.quantity}× {i.product_name}
                    {i.variant_label ? <span className="text-muted"> · {i.variant_label}</span> : null}
                    {i.sku ? <span className="text-xs text-muted"> · SKU {i.sku}</span> : null}
                  </span>
                  <span className="tabular">{formatBRL(i.total_cents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular">{formatBRL(order.subtotal_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Frete ({order.shipping_uf})</dt><dd className="tabular">{formatBRL(order.shipping_cents)}</dd></div>
              {order.discount_cents > 0 ? (
                <div className="flex justify-between text-success"><dt>Desconto {order.coupon_code}</dt><dd className="tabular">− {formatBRL(order.discount_cents)}</dd></div>
              ) : null}
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular">{formatBRL(order.total_cents)}</dd></div>
            </dl>
          </Panel>

          <Panel title="Histórico (auditoria)">
            <ol className="grid gap-3 text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5 border-l-2 border-gold/60 pl-3">
                  <span className="font-medium">
                    {EVENT[e.type] ?? e.type}
                    {e.to_status ? <span className="text-muted"> → {ORDER_STATUS[e.to_status as keyof typeof ORDER_STATUS]?.label ?? e.to_status}</span> : null}
                  </span>
                  <span className="text-xs text-muted">
                    {DATE.format(new Date(e.created_at))} ·{" "}
                    {e.actor_kind === "admin" ? `admin: ${actorName(e.actor_id) ?? "—"}` : e.actor_kind === "stripe" ? "Stripe" : e.actor_kind === "customer" ? "cliente" : "sistema"}
                  </span>
                  {e.message ? <span className="text-ink-soft">{e.message}</span> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Ações">
            <OrderActions orderId={order.id} status={order.status} method={order.payment_method} paymentStatus={order.payment_status} />
          </Panel>
          <Panel title="Cliente e entrega">
            <div className="grid gap-1 text-sm">
              <p className="font-medium">{order.customer_name}</p>
              <p>
                <a className="underline" href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
              </p>
              <p>
                <a className="underline" href={`https://wa.me/${order.customer_phone}`} target="_blank" rel="noopener noreferrer">
                  {formatBrPhone(order.customer_phone)}
                </a>
              </p>
              <p className="mt-3">
                {addr.street}, {addr.number}
                {addr.complement ? ` · ${addr.complement}` : ""}
              </p>
              <p>{addr.district} · {addr.city}/{addr.uf}</p>
              <p>CEP {formatCep(addr.cep)} {order.cep_verified ? <span className="text-success">(verificado)</span> : <span className="text-gold-ink">(não verificado)</span>}</p>
              {order.customer_notes ? <p className="mt-3 rounded-xs bg-cream p-2 text-ink-soft">“{order.customer_notes}”</p> : null}
              {order.tracking_code ? <p className="mt-3">Rastreio: <span className="tabular font-medium">{order.tracking_code}</span></p> : null}
            </div>
          </Panel>
          <Panel title="Link do cliente">
            <p className="text-xs break-all text-muted">{`${siteUrl}/pedido/${order.public_token}`}</p>
            <Link href={`/pedido/${order.public_token}`} target="_blank" className="mt-2 inline-flex min-h-10 items-center text-sm underline">
              Abrir página do pedido
            </Link>
            {order.stripe_payment_intent_id ? (
              <p className="mt-3 text-xs text-muted">Stripe: {order.stripe_payment_intent_id}</p>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
