// Hello World
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AffiliateResponseForm } from "@/components/affiliates/AffiliateStatusParts";
import { CopyButton, Deadline } from "@/components/checkout/OrderLive";
import { Badge } from "@/components/ui/Badge";
import { siteUrl } from "@/lib/env";
import { AFFILIATE_STATUS } from "@/lib/order-status";
import { getPublicDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status da candidatura", robots: { index: false }, referrer: "no-referrer" };

const statusSchema = z.object({
  first_name: z.string(),
  status: z.enum(["pending", "info_requested", "approved", "rejected"]),
  created_at: z.string(),
  info_request_message: z.string().nullable(),
  server_now: z.string(),
  coupon: z
    .object({
      code: z.string(),
      value: z.number(),
      kind: z.string(),
      starts_at: z.string(),
      expires_at: z.string().nullable(),
      is_active: z.boolean(),
      uses_count: z.number(),
      paid_orders: z.number(),
    })
    .nullable(),
});

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AffiliateStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();
  const db = getPublicDb();
  if (!db) notFound();
  const { data } = await db.rpc("get_affiliate_status", { p_token: token });
  const parsed = statusSchema.safeParse(data);
  if (!parsed.success) notFound();
  const s = parsed.data;
  const status = AFFILIATE_STATUS[s.status];
  const coupon = s.coupon;
  const expired = coupon?.expires_at ? new Date(coupon.expires_at) <= new Date(s.server_now) : false;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-8 sm:pt-16">
      <p className="type-micro text-muted">Candidatura enviada em {DATE.format(new Date(s.created_at))}</p>
      <h1 className="type-brand mt-3 text-3xl sm:text-4xl">Olá, {s.first_name}</h1>
      <div className="mt-4">
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-4 text-sm text-muted">Salve este link: ele é a única forma de acompanhar sua candidatura.</p>

      {s.status === "pending" ? (
        <p className="mt-10 text-lg leading-relaxed text-ink-soft">
          Recebemos sua candidatura. Nossa equipe vai conferir o perfil e o plano de divulgação antes de decidir.
        </p>
      ) : null}

      {s.status === "info_requested" ? (
        <section className="mt-10 rounded-xs border border-gold/40 bg-[#fbf3e1] p-6">
          <h2 className="type-brand text-xl">Precisamos de mais informações</h2>
          <p className="mt-3 whitespace-pre-line text-ink-soft">{s.info_request_message}</p>
          <AffiliateResponseForm token={token} />
        </section>
      ) : null}

      {s.status === "rejected" ? (
        <p className="mt-10 text-lg leading-relaxed text-ink-soft">
          Desta vez sua candidatura não foi aprovada. Obrigado pelo interesse na Maverick.
        </p>
      ) : null}

      {s.status === "approved" && coupon ? (
        <section className="mt-10 rounded-xs bg-ink p-6 text-cream on-dark sm:p-10">
          <p className="type-micro text-gold-light">Seu código exclusivo</p>
          <p className="type-monument mt-4 text-[clamp(2.5rem,9vw,4.5rem)] break-all">{coupon.code}</p>
          <p className="mt-4 text-cream/80">
            {coupon.value}% de desconto · 1 uso por cliente ·{" "}
            {expired || !coupon.is_active ? (
              <span className="text-gold-light">código encerrado</span>
            ) : coupon.expires_at ? (
              <>
                expira em <Deadline expiresAt={coupon.expires_at} serverNow={s.server_now} />
              </>
            ) : null}
          </p>
          {!expired && coupon.is_active ? (
            <div className="mt-8 grid gap-3 sm:max-w-sm">
              <CopyButton value={coupon.code} label="Copiar código" />
              <CopyButton value={`${siteUrl}/loja?cupom=${coupon.code}`} label="Copiar link da loja com o código" />
            </div>
          ) : null}
          <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-cream/15 pt-6 sm:max-w-sm">
            <div>
              <dt className="type-micro text-cream/60">Usos</dt>
              <dd className="tabular mt-1 text-2xl">{coupon.uses_count}</dd>
            </div>
            <div>
              <dt className="type-micro text-cream/60">Pedidos pagos</dt>
              <dd className="tabular mt-1 text-2xl">{coupon.paid_orders}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
