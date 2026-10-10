// Hello World
import Link from "next/link";
import { AdminHeader, EmptyState, TableWrap } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatBRL } from "@/lib/br";
import type { OrderStatus } from "@/lib/database.types";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/order-status";
import { getServiceDb } from "@/lib/supabase/server";

export const metadata = { title: "Pedidos" };

const FILTERS: { value: OrderStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "awaiting_payment", label: "Aguardando pagamento" },
  { value: "paid", label: "Pagos" },
  { value: "preparing", label: "Em separação" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregues" },
  { value: "canceled", label: "Cancelados" },
  { value: "expired", label: "Expirados" },
];

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

export default async function AdminOrders({ searchParams }: Props) {
  const { db } = await requireAdmin();
  const { status = "todos", q = "" } = await searchParams;

  // Libera reservas vencidas antes de listar (mesma rotina do cron).
  const expired = await getServiceDb().rpc("expire_stale_orders");
  if (expired.error) console.error("[admin/pedidos] expire", expired.error.message);

  let query = db
    .from("orders")
    .select("id, number, created_at, customer_name, customer_email, total_cents, payment_method, status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "todos" && FILTERS.some((f) => f.value === status)) query = query.eq("status", status as OrderStatus);
  const term = q.trim();
  if (/^\d{1,9}$/.test(term)) query = query.eq("number", Number(term));
  else if (term.includes("@")) query = query.eq("customer_email", term.toLowerCase());

  const { data: orders, error } = await query;

  return (
    <div>
      <AdminHeader title="Pedidos" description="Confirme pagamentos Pix, acompanhe envios e consulte o histórico de cada pedido." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrar por status" className="-mx-1 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "todos" ? "/admin/pedidos" : `/admin/pedidos?status=${f.value}`}
              aria-current={status === f.value ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-sm px-3 text-sm ${
                status === f.value ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          {status !== "todos" ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="q" className="sr-only">
            Buscar por número ou e-mail
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Nº do pedido ou e-mail"
            className="min-h-10 w-56 rounded-sm border border-line-strong bg-paper px-3 text-sm"
          />
          <button type="submit" className="min-h-10 rounded-sm bg-ink px-4 text-sm text-paper">
            Buscar
          </button>
        </form>
      </div>

      {error ? (
        <EmptyState>Não foi possível carregar os pedidos.</EmptyState>
      ) : !orders || orders.length === 0 ? (
        <EmptyState>Nenhum pedido encontrado.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Pagamento</th>
              <th className="text-right">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const s = ORDER_STATUS[o.status];
              return (
                <tr key={o.id} className="hover:bg-cream/60">
                  <td>
                    <Link href={`/admin/pedidos/${o.id}`} className="inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline">
                      nº {o.number}
                    </Link>
                  </td>
                  <td className="text-muted">{DATE.format(new Date(o.created_at))}</td>
                  <td>
                    <span className="block">{o.customer_name}</span>
                    <span className="block text-xs text-muted">{o.customer_email}</span>
                  </td>
                  <td>{PAYMENT_METHOD[o.payment_method]}</td>
                  <td className="tabular text-right">{formatBRL(o.total_cents)}</td>
                  <td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
