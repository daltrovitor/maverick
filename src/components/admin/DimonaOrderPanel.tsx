// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { refreshOrderDimona, sendOrderToDimona, type AdminResult } from "@/app/admin/actions/orders";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Props {
  readonly orderId: string;
  readonly paid: boolean;
  readonly dimonaId: string | null;
  readonly status: string | null;
  readonly trackingUrl: string | null;
  readonly lastError: string | null;
  readonly sentAt: string | null;
}

/** Situação do pedido na Dimona e ações de envio/consulta (o repasse automático cobre o caso comum). */
export function DimonaOrderPanel({ orderId, paid, dimonaId, status, trackingUrl, lastError, sentAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<AdminResult>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });

  return (
    <div className="grid gap-4 text-sm">
      {dimonaId ? (
        <dl className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-muted">Pedido Dimona:</dt>
            <dd className="tabular font-medium">{dimonaId}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-muted">Status:</dt>
            <dd>{status ? <Badge tone="info">{status}</Badge> : "aguardando o primeiro retorno"}</dd>
          </div>
          {sentAt ? (
            <div className="flex flex-wrap gap-2">
              <dt className="text-muted">Enviado em:</dt>
              <dd>{sentAt}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-ink-soft">{paid ? "Ainda não enviado à Dimona." : "Será enviado à Dimona quando o pagamento for confirmado."}</p>
      )}

      {lastError ? (
        <p role="alert" className="rounded-xs border border-danger/30 bg-[#fbeeed] px-3 py-2 text-xs text-danger">
          {lastError}
        </p>
      ) : null}

      {trackingUrl ? (
        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center underline">
          Abrir rastreio da Dimona
        </a>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!dimonaId && paid ? (
          <Button size="sm" loading={pending} onClick={() => run(() => sendOrderToDimona(orderId))}>
            {lastError ? "Tentar enviar de novo" : "Enviar para a Dimona"}
          </Button>
        ) : null}
        {dimonaId ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => refreshOrderDimona(orderId))}>
            Atualizar status
          </Button>
        ) : null}
      </div>
      {dimonaId ? (
        <p className="text-xs text-muted">Lembrete: o pedido entra na Dimona aguardando pagamento. Pague-o no painel da Dimona.</p>
      ) : null}
    </div>
  );
}
