// Hello World
import { notFound } from "next/navigation";
import { AffiliateReview, RevealCpf } from "@/components/admin/AffiliateReview";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatBRL, formatBrPhone, maskCpf } from "@/lib/br";
import { siteUrl } from "@/lib/env";
import { AFFILIATE_STATUS } from "@/lib/order-status";

export const metadata = { title: "Candidatura" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminAffiliateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireAdmin();
  const { data: a } = await db.from("affiliate_applications").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const [{ data: coupons }, { data: attempts }, { data: sameCpf }] = await Promise.all([
    db.from("coupons").select("id, code, starts_at, expires_at, uses_count, is_active").eq("affiliate_application_id", id).order("created_at", { ascending: false }),
    db.from("affiliate_attempts").select("id, created_at").eq("existing_application_id", id).order("created_at", { ascending: false }),
    db.from("affiliate_applications").select("id, full_name, phone, status").eq("cpf", a.cpf).neq("id", id),
  ]);
  const couponIds = (coupons ?? []).map((c) => c.id);
  const { data: orders } = couponIds.length
    ? await db.from("orders").select("id, total_cents, status").in("coupon_id", couponIds)
    : { data: [] as { id: string; total_cents: number; status: string }[] };
  const paid = (orders ?? []).filter((o) => ["paid", "preparing", "shipped", "delivered"].includes(o.status));
  const st = AFFILIATE_STATUS[a.status];

  return (
    <div>
      <AdminHeader title={a.full_name} description={`Enviada em ${DATE.format(new Date(a.created_at))}`} actions={<Badge tone={st.tone}>{st.label}</Badge>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Panel title="Identificação">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted">CPF</dt><dd><RevealCpf cpf={a.cpf} masked={maskCpf(a.cpf)} /></dd></div>
              <div><dt className="text-xs text-muted">Telefone</dt><dd><a className="underline" href={`https://wa.me/${a.phone}`} target="_blank" rel="noopener noreferrer">{formatBrPhone(a.phone)}</a></dd></div>
              <div><dt className="text-xs text-muted">E-mail</dt><dd>{a.email}</dd></div>
              <div><dt className="text-xs text-muted">Consentimento LGPD</dt><dd>{DATE.format(new Date(a.privacy_consent_at))}</dd></div>
            </dl>
            {sameCpf && sameCpf.length > 0 ? (
              <p className="mt-4 rounded-xs border border-gold/40 bg-[#fbf3e1] px-3 py-2 text-xs text-gold-ink">
                Atenção: este CPF tem outra(s) candidatura(s) com telefone diferente ({sameCpf.map((x) => `${x.full_name} · ${AFFILIATE_STATUS[x.status].label}`).join("; ")}).
              </p>
            ) : null}
          </Panel>
          <Panel title="Perfil e audiência">
            <dl className="grid gap-4 text-sm">
              <div><dt className="text-xs text-muted">Perfil ({a.platform})</dt><dd><a className="break-all underline" href={a.profile_url} target="_blank" rel="noopener noreferrer nofollow">{a.profile_url}</a></dd></div>
              <div><dt className="text-xs text-muted">Seguidores declarados</dt><dd className="tabular">{a.followers_declared.toLocaleString("pt-BR")}{a.followers_verified !== null ? ` · conferidos: ${a.followers_verified.toLocaleString("pt-BR")}` : ""}</dd></div>
              <div><dt className="text-xs text-muted">Público</dt><dd className="whitespace-pre-line">{a.audience}</dd></div>
            </dl>
          </Panel>
          <Panel title="Plano de vendas">
            <dl className="grid gap-4 text-sm">
              <div><dt className="text-xs text-muted">Previsão mensal</dt><dd className="tabular">{a.sales_forecast_monthly} unidades</dd></div>
              <div><dt className="text-xs text-muted">Base da previsão</dt><dd className="whitespace-pre-line">{a.sales_forecast_basis}</dd></div>
              <div><dt className="text-xs text-muted">Estratégia</dt><dd className="whitespace-pre-line">{a.strategy}</dd></div>
              <div><dt className="text-xs text-muted">Canais</dt><dd>{a.channels.join(", ")}</dd></div>
              {a.info_request_message ? <div><dt className="text-xs text-muted">Informações pedidas</dt><dd className="whitespace-pre-line">{a.info_request_message}</dd></div> : null}
              {a.applicant_response ? <div><dt className="text-xs text-muted">Resposta do candidato</dt><dd className="whitespace-pre-line">{a.applicant_response}</dd></div> : null}
              {a.admin_notes ? <div><dt className="text-xs text-muted">Observações internas</dt><dd className="whitespace-pre-line">{a.admin_notes}</dd></div> : null}
            </dl>
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <Panel title="Decisão">
            <AffiliateReview id={a.id} status={a.status} />
          </Panel>
          {coupons && coupons.length > 0 ? (
            <Panel title="Código e resultados">
              {coupons.map((c) => (
                <div key={c.id} className="text-sm">
                  <p className="tabular text-lg font-semibold">{c.code}</p>
                  <p className="text-muted">{DATE.format(new Date(c.starts_at))} → {c.expires_at ? DATE.format(new Date(c.expires_at)) : "sem fim"} · usado {c.uses_count}×</p>
                </div>
              ))}
              <p className="mt-3 text-sm">Pedidos pagos: <span className="tabular font-medium">{paid.length}</span> · {formatBRL(paid.reduce((s, o) => s + o.total_cents, 0))}</p>
            </Panel>
          ) : null}
          <Panel title="Link do candidato">
            <p className="text-xs break-all text-muted">{`${siteUrl}/afiliados/status/${a.status_token}`}</p>
          </Panel>
          {attempts && attempts.length > 0 ? (
            <Panel title="Tentativas duplicadas">
              <ul className="text-sm text-ink-soft">
                {attempts.map((t) => <li key={t.id}>{DATE.format(new Date(t.created_at))}</li>)}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
