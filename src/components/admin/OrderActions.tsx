// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmPix, rejectPix, setOrderStatus, type AdminResult } from "@/app/admin/actions/orders";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import type { OrderStatus, PaymentMethod } from "@/lib/database.types";
import { NEXT_STATUS, ORDER_STATUS } from "@/lib/order-status";

interface Props {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly method: PaymentMethod;
  readonly paymentStatus: string;
}

export function OrderActions({ orderId, status, method, paymentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [tracking, setTracking] = useState("");

  const run = (fn: () => Promise<AdminResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        setNote("");
        setReason("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const pixAwaiting = method === "pix" && (status === "awaiting_payment" || status === "expired");
  const next = NEXT_STATUS[status] ?? [];

  if (!pixAwaiting && next.length === 0 && !(status === "awaiting_payment" && method === "card")) {
    return <p className="text-sm text-muted">Nenhuma ação disponível para este pedido.</p>;
  }

  return (
    <div className="grid gap-6">
      {pixAwaiting ? (
        <div className="grid gap-4">
          <p className="text-sm text-ink-soft">
            Confira no extrato bancário se o valor exato entrou antes de confirmar.
            {status === "expired" ? " O pedido expirou: confirmar tenta reservar o estoque de novo." : ""}
          </p>
          <TextField label="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: conferido no extrato às 14h" />
          <Button
            loading={pending}
            onClick={() => run(() => confirmPix(orderId, note), "Confirmar o recebimento deste Pix?")}
          >
            Confirmar pagamento Pix
          </Button>
          {status === "awaiting_payment" ? (
            <div className="grid gap-3 border-t border-line pt-4">
              <TextAreaField
                label="Motivo da recusa"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                hint="Obrigatório. O estoque reservado volta para a loja."
              />
              <Button
                variant="danger"
                loading={pending}
                disabled={reason.trim().length < 3}
                onClick={() => run(() => rejectPix(orderId, reason), "Recusar este pagamento e cancelar o pedido?")}
              >
                Recusar pagamento
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "awaiting_payment" && method === "card" ? (
        <div className="grid gap-3">
          <p className="text-sm text-ink-soft">
            Aguardando a confirmação automática do Stripe. Cancelar libera o estoque reservado.
          </p>
          <Button
            variant="secondary"
            loading={pending}
            onClick={() => run(() => setOrderStatus(orderId, "canceled", "", note), "Cancelar este pedido?")}
          >
            Cancelar pedido
          </Button>
        </div>
      ) : null}

      {next.length > 0 ? (
        <div className="grid gap-4">
          {next.includes("shipped") ? (
            <TextField label="Código de rastreio" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={60} />
          ) : null}
          <TextField label="Observação interna (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <Button
                key={s}
                variant={s === "canceled" ? "danger" : "primary"}
                loading={pending}
                onClick={() =>
                  run(
                    () => setOrderStatus(orderId, s, tracking, note),
                    s === "canceled"
                      ? paymentStatus === "paid"
                        ? "Cancelar um pedido PAGO? O estoque volta para a loja e o reembolso deve ser feito manualmente."
                        : "Cancelar este pedido?"
                      : undefined,
                  )
                }
              >
                {s === "canceled" ? "Cancelar pedido" : `Marcar como ${ORDER_STATUS[s].label.toLowerCase()}`}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
