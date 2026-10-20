// Hello World
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CopyButton, Deadline, OrderAutoRefresh } from "@/components/checkout/OrderLive";
import { StripeCardPayment } from "@/components/checkout/StripeCardPayment";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatBRL, formatBrPhone, formatCep } from "@/lib/br";
import { getStoreSettings } from "@/lib/catalog";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/order-status";
import { getOrderByToken } from "@/lib/orders";
import { ensureStripePix, loadPaymentOrder, pixInstructions, pixQrSvg, syncPaymentIntent, type StripePixCharge } from "@/lib/payments";
import { productImageUrl } from "@/lib/storage";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seu pedido",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pagamento?: string }>;
};

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const EVENT_LABEL: Record<string, string> = {
  created: "Pedido criado",
  pix_confirmed: "Pagamento Pix confirmado",
  pix_rejected: "Pagamento Pix não identificado",
  card_paid: "Pagamento com cartão aprovado",
  card_failed: "Pagamento com cartão não concluído",
  expired: "Prazo de pagamento encerrado",
  stock_conflict: "Pagamento recebido · em análise pela loja",
  dimona_status: "Produção e entrega atualizadas",
};

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ token }, { pagamento }] = await Promise.all([params, searchParams]);
  const stripeReady = isStripeConfigured();

  // Confere o pagamento direto no Stripe antes de montar a página (rede de segurança do webhook).
  const payment = /^[0-9a-f]{64}$/.test(token) ? await loadPaymentOrder({ token }).catch(() => null) : null;
  if (payment?.status === "awaiting_payment" && payment.stripe_payment_intent_id && stripeReady) {
    await syncPaymentIntent(payment).catch((err: unknown) => console.error("[pedido] sync", err));
  }

  const order = await getOrderByToken(token);
  if (!order) notFound();
  const settings = await getStoreSettings();

  const status = ORDER_STATUS[order.status];
  const awaiting = order.status === "awaiting_payment";
  const awaitingPix = awaiting && order.payment_method === "pix";

  // Pix pelo Stripe (confirmação automática); se não sair, cai no Pix manual da loja.
  let stripePix: StripePixCharge | null = null;
  if (awaitingPix && order.pix_provider === "stripe") {
    if (order.pix_qr_data) stripePix = { data: order.pix_qr_data, expiresAt: order.pix_qr_expires_at ?? null };
    else if (payment && stripeReady) {
      stripePix = await ensureStripePix(payment).catch((err: unknown) => {
        console.error("[pedido] pix stripe", err);
        return null;
      });
    }
  }
  const stripePixSvg = stripePix ? await pixQrSvg(stripePix.data) : null;
  const pixDeadline = stripePix?.expiresAt ?? order.expires_at;
  const pix = awaitingPix && !stripePix && settings ? await pixInstructions(settings, order) : null;
  const whatsapp = settings?.whatsapp;
  const whatsappText = encodeURIComponent(
    `Olá! Segue o comprovante do Pix do pedido nº ${order.number} (${formatBRL(order.total_cents)}).`,
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      {/* Cartão: o formulário do Stripe não pode ser recarregado enquanto o cliente digita. */}
      {awaitingPix ? <OrderAutoRefresh seconds={stripePix ? 8 : 20} /> : null}
      {awaiting && order.payment_method === "card" && pagamento === "retorno" ? <OrderAutoRefresh seconds={6} /> : null}

      <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-micro text-muted">Pedido realizado em {DATE.format(new Date(order.created_at))}</p>
          <h1 className="type-monument mt-2 text-[clamp(2.75rem,8vw,5.5rem)]">Pedido nº {order.number}</h1>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Badge tone={status.tone}>{status.label}</Badge>
          <p className="text-sm text-ink-soft">{PAYMENT_METHOD[order.payment_method]}</p>
        </div>
      </header>

      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft" role="status">
        {status.customer}
      </p>
      <p className="mt-2 text-sm text-muted">
        Guarde este link (salve nos favoritos): é por ele que você acompanha o pedido a qualquer momento.
      </p>

      {pagamento === "cancelado" && awaiting ? (
        <p className="mt-6 rounded-xs border border-gold/40 bg-[#fbf3e1] px-4 py-3 text-sm text-gold-ink">
          O pagamento com cartão não foi concluído. Você pode tentar de novo abaixo enquanto o pedido estiver reservado.
        </p>
      ) : null}
      {pagamento === "indisponivel" && awaiting ? (
        <p className="mt-6 rounded-xs border border-gold/40 bg-[#fbf3e1] px-4 py-3 text-sm text-gold-ink">
          Seu pedido foi reservado, mas não conseguimos abrir o pagamento com cartão agora. Tente novamente abaixo.
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="grid content-start gap-10 lg:col-span-7">
          {stripePix && stripePixSvg ? (
            <section aria-labelledby="pix-title" className="rounded-xs border border-ink/15 bg-cream p-6 sm:p-8">
              <h2 id="pix-title" className="type-brand text-xl">
                Pague com Pix
              </h2>
              {pixDeadline ? (
                <p className="mt-2 text-sm text-ink-soft">
                  O código vale por mais <Deadline expiresAt={pixDeadline} serverNow={order.server_now} />.
                </p>
              ) : null}
              <div className="mt-6 grid gap-6 sm:grid-cols-[200px_1fr] sm:items-start">
                <div
                  className="mx-auto w-[200px] rounded-xs bg-paper p-2"
                  role="img"
                  aria-label={`QR Code Pix de ${formatBRL(order.total_cents)}`}
                  // SVG gerado no servidor pela biblioteca qrcode a partir do código do Stripe (sem dados do usuário).
                  dangerouslySetInnerHTML={{ __html: stripePixSvg }}
                />
                <div className="grid gap-4">
                  <p className="tabular text-3xl font-semibold">{formatBRL(order.total_cents)}</p>
                  <CopyButton value={stripePix.data} label="Copiar código Pix" />
                </div>
              </div>
              <ol className="mt-6 grid gap-2 border-t border-line pt-6 text-sm leading-relaxed text-ink-soft">
                <li>1. Abra o app do seu banco e escolha pagar com Pix por QR Code ou copia e cola.</li>
                <li>2. Confira o valor de {formatBRL(order.total_cents)} e confirme.</li>
                <li>3. A confirmação é automática: esta página atualiza sozinha assim que o banco aprovar.</li>
              </ol>
            </section>
          ) : null}

          {awaitingPix && !stripePix && !pix ? (
            <section aria-labelledby="pix-title" className="rounded-xs border border-gold/40 bg-[#fbf3e1] p-6 sm:p-8">
              <h2 id="pix-title" className="type-brand text-xl">
                Pix temporariamente indisponível
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gold-ink">
                Seu pedido está reservado, mas não conseguimos gerar o QR Code agora. Atualize a página em alguns
                instantes{whatsapp ? " ou fale com a gente pelo WhatsApp" : ""}.
              </p>
              {whatsapp ? (
                <ButtonLink
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Preciso de ajuda para pagar o pedido nº ${order.number}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  className="mt-4"
                >
                  Falar no WhatsApp {formatBrPhone(whatsapp)}
                </ButtonLink>
              ) : null}
            </section>
          ) : null}

          {pix ? (
            <section aria-labelledby="pix-title" className="rounded-xs border border-ink/15 bg-cream p-6 sm:p-8">
              <h2 id="pix-title" className="type-brand text-xl">
                Pague com Pix
              </h2>
              {order.expires_at ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Reservamos seu pedido por mais <Deadline expiresAt={order.expires_at} serverNow={order.server_now} />.
                </p>
              ) : null}
              <div className="mt-6 grid gap-6 sm:grid-cols-[200px_1fr] sm:items-start">
                <div
                  className="mx-auto w-[200px] rounded-xs bg-paper p-2"
                  role="img"
                  aria-label={`QR Code Pix de ${formatBRL(order.total_cents)}`}
                  // SVG gerado no servidor pela biblioteca qrcode a partir do BR Code (sem dados do usuário).
                  dangerouslySetInnerHTML={{ __html: pix.qrSvg }}
                />
                <div className="grid gap-4">
                  <p className="tabular text-3xl font-semibold">{formatBRL(order.total_cents)}</p>
                  <CopyButton value={pix.payload} label="Copiar código Pix" />
                  <dl className="grid gap-1 text-sm text-ink-soft">
                    <div className="flex gap-2">
                      <dt className="text-muted">Favorecido:</dt>
                      <dd>{pix.holderName}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted">Chave:</dt>
                      <dd className="break-all">{pix.key}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <ol className="mt-6 grid gap-2 border-t border-line pt-6 text-sm leading-relaxed text-ink-soft">
                <li>1. Abra o app do seu banco e pague com o QR Code ou o código copia-e-cola.</li>
                <li>2. Confira o valor exato e o favorecido antes de confirmar.</li>
                <li>
                  3. A confirmação é feita manualmente pela nossa equipe. Esta página atualiza sozinha quando o pagamento for
                  confirmado.
                </li>
              </ol>
              {whatsapp ? (
                <ButtonLink
                  href={`https://wa.me/${whatsapp}?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="ghost"
                  className="mt-4"
                >
                  Enviar comprovante pelo WhatsApp {formatBrPhone(whatsapp)}
                </ButtonLink>
              ) : null}
            </section>
          ) : null}

          {awaiting && order.payment_method === "card" ? (
            <section aria-labelledby="card-title" className="rounded-xs border border-ink/15 bg-cream p-6 sm:p-8">
              <h2 id="card-title" className="type-brand text-xl">
                Pagamento com cartão
              </h2>
              {pagamento === "retorno" ? (
                <p className="mt-3 text-ink-soft" role="status">
                  Estamos confirmando o pagamento com o banco. Esta página atualiza em instantes.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-ink-soft">
                    Crédito ou débito, aqui mesmo no site. O pedido segue reservado
                    {order.expires_at ? (
                      <>
                        {" "}
                        por <Deadline expiresAt={order.expires_at} serverNow={order.server_now} />
                      </>
                    ) : null}
                    .
                  </p>
                  <div className="mt-6">
                    <StripeCardPayment token={token} totalLabel={formatBRL(order.total_cents)} />
                  </div>
                </>
              )}
            </section>
          ) : null}

          {order.tracking_code || order.delivery_tracking_url ? (
            <section aria-labelledby="track-title" className="rounded-xs border border-line p-6">
              <h2 id="track-title" className="type-micro text-ink-soft">
                Rastreio da entrega
              </h2>
              {order.tracking_code ? <p className="tabular mt-3 text-xl font-medium">{order.tracking_code}</p> : null}
              {order.delivery_tracking_url ? (
                <a
                  href={order.delivery_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-12 items-center border-b border-ink text-sm hover:text-gold-ink"
                >
                  Acompanhar produção e entrega
                </a>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="type-micro text-ink-soft">
              Histórico
            </h2>
            <ol className="mt-4 border-l border-line pl-5">
              {order.events.map((event, i) => (
                <li key={`${event.created_at}-${i}`} className="relative pb-5 last:pb-0">
                  <span aria-hidden="true" className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-gold" />
                  <p className="text-sm font-medium">
                    {EVENT_LABEL[event.type] ??
                      (event.to_status ? ORDER_STATUS[event.to_status as keyof typeof ORDER_STATUS]?.label : null) ??
                      "Atualização"}
                  </p>
                  <p className="text-xs text-muted">{DATE.format(new Date(event.created_at))}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="lg:col-span-5" aria-label="Resumo do pedido">
          <div className="rounded-xs border border-line p-6">
            <ul className="divide-y divide-line">
              {order.items.map((item, i) => {
                const url = productImageUrl(item.image_path);
                return (
                  <li key={`${item.product_name}-${i}`} className="flex items-center gap-3 py-3">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xs bg-cream">
                      {url ? <Image src={url} alt="" fill sizes="56px" className="object-contain p-1" /> : null}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">{item.product_name}</p>
                      <p className="text-muted">
                        {item.quantity}× {item.variant_label ?? ""}
                      </p>
                    </div>
                    <p className="tabular text-sm">{formatBRL(item.total_cents)}</p>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 grid gap-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="tabular">{formatBRL(order.subtotal_cents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Frete ({order.shipping_address.uf})</dt>
                <dd className="tabular">{order.shipping_cents === 0 ? "Grátis" : formatBRL(order.shipping_cents)}</dd>
              </div>
              {order.discount_cents > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>Desconto {order.coupon_code ? `(${order.coupon_code})` : ""}</dt>
                  <dd className="tabular">− {formatBRL(order.discount_cents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatBRL(order.total_cents)}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-6 rounded-xs border border-line p-6 text-sm leading-relaxed text-ink-soft">
            <h2 className="type-micro text-ink-soft">Entrega</h2>
            <p className="mt-3 text-ink">{order.customer_name}</p>
            <p>
              {order.shipping_address.street}, {order.shipping_address.number}
              {order.shipping_address.complement ? ` · ${order.shipping_address.complement}` : ""}
            </p>
            <p>
              {order.shipping_address.district} · {order.shipping_address.city}/{order.shipping_address.uf}
            </p>
            <p>CEP {formatCep(order.shipping_address.cep)}</p>
            {order.shipping_estimate ? <p className="mt-2 text-muted">Prazo estimado: {order.shipping_estimate}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
