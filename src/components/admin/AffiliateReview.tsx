// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveAffiliate, rejectAffiliate, requestAffiliateInfo } from "@/app/admin/actions/store";
import type { AdminResult } from "@/app/admin/actions/orders";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { formatCpf } from "@/lib/br";

export function RevealCpf({ cpf, masked }: { readonly cpf: string; readonly masked: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular">{shown ? formatCpf(cpf) : masked}</span>
      <button type="button" className="min-h-10 text-xs underline" onClick={() => setShown((v) => !v)}>
        {shown ? "Ocultar" : "Mostrar"}
      </button>
    </span>
  );
}

export function AffiliateReview({ id, status }: { readonly id: string; readonly status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [followers, setFollowers] = useState("");
  const [notes, setNotes] = useState("");
  const [info, setInfo] = useState("");

  const run = (fn: () => Promise<AdminResult>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.message);
    });
  };

  if (status !== "pending" && status !== "info_requested") {
    return <p className="text-sm text-muted">Esta candidatura já foi decidida.</p>;
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <TextField
          label="Seguidores conferidos no perfil"
          type="number"
          min={0}
          inputMode="numeric"
          value={followers}
          onChange={(e) => setFollowers(e.target.value)}
          hint="Abra o link do perfil e informe o número real. A aprovação exige 1.000 ou mais."
        />
        <TextAreaField label="Observações internas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button
          loading={pending}
          disabled={!followers}
          onClick={() =>
            run(
              () => approveAffiliate(id, Number.parseInt(followers, 10), notes),
              "Aprovar e gerar o código de 25% válido pelas próximas 24 horas?",
            )
          }
        >
          Aprovar e gerar código
        </Button>
      </div>
      {status === "pending" ? (
        <div className="grid gap-3 border-t border-line pt-4">
          <TextAreaField
            label="Pedir mais informações"
            rows={3}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            hint="O candidato vê esta mensagem no link de acompanhamento e pode responder."
          />
          <Button variant="secondary" loading={pending} disabled={info.trim().length < 10} onClick={() => run(() => requestAffiliateInfo(id, info), "Enviar o pedido de informações?")}>
            Pedir informações
          </Button>
        </div>
      ) : null}
      <div className="border-t border-line pt-4">
        <Button variant="danger" loading={pending} onClick={() => run(() => rejectAffiliate(id, notes), "Recusar esta candidatura? A combinação CPF + telefone não poderá se candidatar de novo.")}>
          Recusar candidatura
        </Button>
      </div>
    </div>
  );
}
