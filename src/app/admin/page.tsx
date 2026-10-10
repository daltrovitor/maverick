// Hello World
import Link from "next/link";
import { z } from "zod";
import { AdminHeader, EmptyState, Kpi, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth";
import { formatBRL } from "@/lib/br";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata = { title: "Visão geral" };

const dashSchema = z.object({
  paid_revenue_cents: z.number(),
  paid_orders: z.number(),
  awaiting_pix: z.number(),
  to_ship: z.number(),
  stock_conflicts: z.number(),
  pending_affiliates: z.number(),
  blocked_affiliate_attempts: z.number(),
  by_method: z.record(z.string(), z.object({ orders: z.number(), revenue_cents: z.number() })),
  top_products: z.array(z.object({ product_name: z.string(), quantity: z.number(), revenue_cents: z.number() })),
  low_stock: z.array(z.object({ product_id: z.string(), name: z.string(), variant: z.string().nullable(), stock: z.number() })),
  affiliates: z.array(
    z.object({ id: z.string(), full_name: z.string(), code: z.string(), paid_orders: z.number(), revenue_cents: z.number() }),
  ),
});

export default async function AdminHome() {
  const { db } = await requireAdmin();
  const [{ data, error }, settings, products, rates] = await Promise.all([
    db.rpc("admin_dashboard", { p_days: 30 }),
    db.from("store_settings").select("pix_key, pix_holder_name, pix_city, card_enabled, whatsapp").maybeSingle(),
    db.from("products").select("id", { count: "exact", head: true }),
    db.from("shipping_rates").select("uf", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const dash = dashSchema.safeParse(data);

  const setup = [
    { done: (products.count ?? 0) > 0, label: "Cadastrar o primeiro produto", href: "/admin/produtos/novo" },
    { done: (rates.count ?? 0) > 0, label: "Definir o frete dos estados atendidos", href: "/admin/frete" },
    {
      done: Boolean(settings.data?.pix_key && settings.data.pix_holder_name && settings.data.pix_city),
      label: "Configurar a chave Pix",
      href: "/admin/configuracoes",
    },
    { done: isStripeConfigured(), label: "Conectar o Stripe (variáveis de ambiente)", href: "/admin/configuracoes" },
    { done: Boolean(settings.data?.whatsapp), label: "Informar o WhatsApp de atendimento", href: "/admin/configuracoes" },
  ];
  const pendingSetup = setup.filter((s) => !s.done);

  return (
    <div>
      <AdminHeader title="Visão geral" description="Últimos 30 dias. Valores consideram apenas pedidos pagos." />

      {pendingSetup.length > 0 ? (
        <Panel title="Para começar a vender" className="mb-6">
          <ul className="grid gap-2">
            {setup.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
                <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                {!s.done ? (
                  <Link href={s.href} className="inline-flex min-h-10 items-center text-gold-ink underline">
                    Resolver
                  </Link>
                ) : (
                  <span className="text-success">Concluído</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {error || !dash.success ? (
        <EmptyState>Não foi possível carregar os indicadores agora.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Receita paga" value={formatBRL(dash.data.paid_revenue_cents)} />
            <Kpi label="Pedidos pagos" value={dash.data.paid_orders} />
            <Kpi label="Pix aguardando conferência" value={dash.data.awaiting_pix} />
            <Kpi label="Pedidos para enviar" value={dash.data.to_ship} />
          </div>

          {dash.data.awaiting_pix > 0 || dash.data.stock_conflicts > 0 || dash.data.pending_affiliates > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {dash.data.awaiting_pix > 0 ? (
                <ButtonLink href="/admin/pedidos?status=awaiting_payment" size="sm">
                  Conferir {dash.data.awaiting_pix} Pix
                </ButtonLink>
              ) : null}
              {dash.data.stock_conflicts > 0 ? (
                <ButtonLink href="/admin/pedidos" size="sm" variant="danger">
                  {dash.data.stock_conflicts} pagamento(s) sem estoque
                </ButtonLink>
              ) : null}
              {dash.data.pending_affiliates > 0 ? (
                <ButtonLink href="/admin/afiliados?status=pending" size="sm" variant="secondary">
                  {dash.data.pending_affiliates} candidatura(s) em análise
                </ButtonLink>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Mais vendidos">
              {dash.data.top_products.length === 0 ? (
                <p className="text-sm text-muted">Sem vendas pagas no período.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {dash.data.top_products.map((p) => (
                    <li key={p.product_name} className="flex justify-between gap-4 py-2">
                      <span>{p.product_name}</span>
                      <span className="tabular text-muted">
                        {p.quantity} un · {formatBRL(p.revenue_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Estoque baixo (até 3 unidades)">
              {dash.data.low_stock.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma variante ativa com estoque baixo.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {dash.data.low_stock.map((v) => (
                    <li key={`${v.product_id}-${v.variant}`} className="flex justify-between gap-4 py-2">
                      <Link href={`/admin/produtos/${v.product_id}`} className="underline-offset-4 hover:underline">
                        {v.name} {v.variant ? <span className="text-muted">· {v.variant}</span> : null}
                      </Link>
                      <span className={`tabular ${v.stock === 0 ? "text-danger" : "text-gold-ink"}`}>{v.stock}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Por forma de pagamento">
              {Object.keys(dash.data.by_method).length === 0 ? (
                <p className="text-sm text-muted">Sem vendas pagas no período.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {Object.entries(dash.data.by_method).map(([method, v]) => (
                    <li key={method} className="flex justify-between gap-4 py-2">
                      <span>{method === "pix" ? "Pix" : "Cartão"}</span>
                      <span className="tabular text-muted">
                        {v.orders} pedidos · {formatBRL(v.revenue_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Afiliados aprovados">
              {dash.data.affiliates.length === 0 ? (
                <p className="text-sm text-muted">Nenhum afiliado aprovado ainda.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {dash.data.affiliates.map((a) => (
                    <li key={`${a.id}-${a.code}`} className="flex justify-between gap-4 py-2">
                      <Link href={`/admin/afiliados/${a.id}`} className="hover:underline">
                        {a.full_name} <span className="text-muted">· {a.code}</span>
                      </Link>
                      <span className="tabular text-muted">
                        {a.paid_orders} pedidos · {formatBRL(a.revenue_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {dash.data.blocked_affiliate_attempts > 0 ? (
                <p className="mt-3 text-xs text-gold-ink">
                  {dash.data.blocked_affiliate_attempts} tentativa(s) de candidatura duplicada bloqueada(s) no período.
                </p>
              ) : null}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
