// Hello World
import Link from "next/link";
import { AdminHeader, EmptyState, TableWrap } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatBRL } from "@/lib/br";
import { formatBps } from "@/lib/custom-pricing";
import type { CustomRequestStatus } from "@/lib/database.types";
import { CUSTOM_STATUS } from "@/lib/order-status";
import { CAP_MODELS } from "@/lib/validation";

export const metadata = { title: "Personalizados" };

const FILTERS: { value: CustomRequestStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  ...(Object.entries(CUSTOM_STATUS) as [CustomRequestStatus, { label: string }][]).map(([value, s]) => ({ value, label: s.label })),
];

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminCustomRequests({ searchParams }: Props) {
  const { db } = await requireAdmin();
  const { status = "todos" } = await searchParams;

  let query = db
    .from("custom_cap_requests")
    .select("id, number, created_at, status, customer_name, customer_email, quantity, cap_model, discount_bps, estimated_total_cents")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "todos" && FILTERS.some((f) => f.value === status)) query = query.eq("status", status as CustomRequestStatus);
  const { data: requests, error } = await query;

  return (
    <div>
      <AdminHeader
        title="Bonés personalizados"
        description="Pedidos enviados pela seção “Crie seu boné” da página inicial, com a arte do cliente e a estimativa da calculadora."
      />

      <nav aria-label="Filtrar por status" className="-mx-1 mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "todos" ? "/admin/personalizados" : `/admin/personalizados?status=${f.value}`}
            aria-current={status === f.value ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-sm px-3 text-sm ${
              status === f.value ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <EmptyState>Não foi possível carregar os pedidos personalizados.</EmptyState>
      ) : !requests || requests.length === 0 ? (
        <EmptyState>Nenhum pedido personalizado ainda.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Modelo</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">Estimativa</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const s = CUSTOM_STATUS[r.status];
              return (
                <tr key={r.id} className="hover:bg-cream/60">
                  <td>
                    <Link href={`/admin/personalizados/${r.id}`} className="inline-flex min-h-10 items-center font-medium underline-offset-4 hover:underline">
                      nº {r.number}
                    </Link>
                  </td>
                  <td className="text-muted">{DATE.format(new Date(r.created_at))}</td>
                  <td>
                    <span className="block">{r.customer_name}</span>
                    <span className="block text-xs text-muted">{r.customer_email}</span>
                  </td>
                  <td>{CAP_MODELS.find((m) => m.value === r.cap_model)?.label.split(" (")[0] ?? r.cap_model}</td>
                  <td className="tabular text-right">{r.quantity}</td>
                  <td className="tabular text-right">
                    {r.estimated_total_cents === null ? "Sob consulta" : formatBRL(r.estimated_total_cents)}
                    {r.discount_bps > 0 ? <span className="block text-xs text-muted">−{formatBps(r.discount_bps)}</span> : null}
                  </td>
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
