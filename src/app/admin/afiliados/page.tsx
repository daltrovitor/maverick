// Hello World
import Link from "next/link";
import { AdminHeader, EmptyState, TableWrap } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { maskCpf } from "@/lib/br";
import type { AffiliateStatus } from "@/lib/database.types";
import { AFFILIATE_STATUS } from "@/lib/order-status";

export const metadata = { title: "Afiliados" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const FILTERS: (AffiliateStatus | "todos")[] = ["todos", "pending", "info_requested", "approved", "rejected"];

export default async function AdminAffiliates({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireAdmin();
  const { status = "todos" } = await searchParams;
  let query = db
    .from("affiliate_applications")
    .select("id, full_name, cpf, platform, followers_declared, sales_forecast_monthly, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "todos" && (FILTERS as string[]).includes(status)) query = query.eq("status", status as AffiliateStatus);
  const [{ data: apps }, { data: attempts }] = await Promise.all([
    query,
    db.from("affiliate_attempts").select("id, existing_application_id, created_at").order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <div>
      <AdminHeader
        title="Afiliados"
        description="Candidaturas ficam pendentes até a sua análise. A aprovação exige os seguidores conferidos no perfil (mínimo 1.000) e gera o código de 25% por 24h."
      />
      <nav aria-label="Filtrar" className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "todos" ? "/admin/afiliados" : `/admin/afiliados?status=${f}`}
            aria-current={status === f ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-sm px-3 text-sm ${status === f ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:text-ink"}`}
          >
            {f === "todos" ? "Todas" : AFFILIATE_STATUS[f].label}
          </Link>
        ))}
      </nav>

      {!apps || apps.length === 0 ? (
        <EmptyState>Nenhuma candidatura.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Candidato</th>
              <th>CPF</th>
              <th>Rede · seguidores (declarados)</th>
              <th>Previsão/mês</th>
              <th>Enviada</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="hover:bg-cream/60">
                <td>
                  <Link href={`/admin/afiliados/${a.id}`} className="inline-flex min-h-10 items-center font-medium hover:underline">
                    {a.full_name}
                  </Link>
                </td>
                <td className="tabular text-muted">{maskCpf(a.cpf)}</td>
                <td>
                  {a.platform} · <span className="tabular">{a.followers_declared.toLocaleString("pt-BR")}</span>
                </td>
                <td className="tabular">{a.sales_forecast_monthly} un</td>
                <td className="text-muted">{DATE.format(new Date(a.created_at))}</td>
                <td>
                  <Badge tone={AFFILIATE_STATUS[a.status].tone}>{AFFILIATE_STATUS[a.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {attempts && attempts.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Tentativas duplicadas bloqueadas (CPF + telefone)</h2>
          <ul className="grid gap-1 text-sm text-ink-soft">
            {attempts.map((t) => (
              <li key={t.id}>
                {DATE.format(new Date(t.created_at))} ·{" "}
                {t.existing_application_id ? (
                  <Link href={`/admin/afiliados/${t.existing_application_id}`} className="underline">
                    candidatura existente
                  </Link>
                ) : (
                  "candidatura removida"
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
