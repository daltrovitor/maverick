// Hello World
import Image from "next/image";
import { notFound } from "next/navigation";
import { CustomRequestActions } from "@/components/admin/CustomRequestActions";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { formatBRL, formatBrPhone } from "@/lib/br";
import { formatBps } from "@/lib/custom-pricing";
import { CUSTOM_STATUS } from "@/lib/order-status";
import { CUSTOM_DESIGNS_BUCKET } from "@/lib/storage";
import { getServiceDb } from "@/lib/supabase/server";
import { CAP_MODELS, CAP_TECHNIQUES } from "@/lib/validation";

export const metadata = { title: "Pedido personalizado" };

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminCustomRequest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireAdmin();
  const { data: request } = await db.from("custom_cap_requests").select("*").eq("id", id).maybeSingle();
  if (!request) notFound();

  // Arte em bucket privado: link assinado de 1 hora, gerado só para o administrador.
  const { data: signed } = await getServiceDb().storage.from(CUSTOM_DESIGNS_BUCKET).createSignedUrl(request.design_path, 3600);
  const designUrl = signed?.signedUrl ?? null;
  const isImage = request.design_mime.startsWith("image/");
  const status = CUSTOM_STATUS[request.status];
  const whatsappText = encodeURIComponent(
    `Olá, ${request.customer_name.split(" ")[0]}! Aqui é da Maverick sobre o seu pedido de boné personalizado nº ${request.number}.`,
  );

  return (
    <div>
      <AdminHeader
        title={`Personalizado nº ${request.number}`}
        description={`Recebido em ${DATE.format(new Date(request.created_at))}`}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Panel title="Arte enviada">
            {designUrl ? (
              <div className="grid gap-4">
                {isImage ? (
                  <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-xs border border-line bg-cream">
                    <Image src={designUrl} alt={`Arte do pedido personalizado nº ${request.number}`} fill sizes="448px" className="object-contain p-4" unoptimized />
                  </div>
                ) : (
                  <p className="text-sm text-ink-soft">Arquivo PDF ({Math.ceil(request.design_size / 1024)} KB).</p>
                )}
                <a href={designUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-sm underline">
                  Baixar arquivo original
                </a>
                <p className="text-xs text-muted">O link expira em 1 hora; recarregue a página para gerar outro.</p>
              </div>
            ) : (
              <p className="text-sm text-danger">Não foi possível gerar o link da arte.</p>
            )}
          </Panel>

          <Panel title="Pedido">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Quantidade</dt>
                <dd className="tabular font-medium">{request.quantity} unidades</dd>
              </div>
              <div>
                <dt className="text-muted">Modelo</dt>
                <dd>{CAP_MODELS.find((m) => m.value === request.cap_model)?.label ?? request.cap_model}</dd>
              </div>
              <div>
                <dt className="text-muted">Cor do boné</dt>
                <dd>{request.cap_color ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Técnica</dt>
                <dd>{CAP_TECHNIQUES.find((t) => t.value === request.technique)?.label ?? request.technique}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Estimativa da calculadora</dt>
                <dd className="tabular">
                  {request.estimated_total_cents === null || request.unit_price_cents === null
                    ? "Sem preço base no momento do pedido (sob consulta)"
                    : `${formatBRL(request.estimated_total_cents)} · ${formatBRL(request.unit_price_cents)}/un. com ${formatBps(request.discount_bps)} de desconto`}
                </dd>
              </div>
              {request.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Observações do cliente</dt>
                  <dd className="whitespace-pre-line rounded-xs bg-cream p-3 text-ink-soft">{request.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Andamento">
            <CustomRequestActions id={request.id} status={request.status} notes={request.admin_notes ?? ""} />
          </Panel>
          <Panel title="Cliente">
            <div className="grid gap-1 text-sm">
              <p className="font-medium">{request.customer_name}</p>
              <p>
                <a className="underline" href={`mailto:${request.customer_email}`}>
                  {request.customer_email}
                </a>
              </p>
              <p>
                <a
                  className="underline"
                  href={`https://wa.me/${request.customer_phone}?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formatBrPhone(request.customer_phone)}
                </a>
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
