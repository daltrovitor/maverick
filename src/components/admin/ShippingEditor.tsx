// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveShippingRates } from "@/app/admin/actions/store";
import { Button } from "@/components/ui/Button";
import { centsToInput, parseBRLToCents, UFS } from "@/lib/br";

interface Row {
  uf: string;
  enabled: boolean;
  price: string;
  estimate: string;
  active: boolean;
}

export function ShippingEditor({
  initial,
}: {
  readonly initial: { uf: string; price_cents: number; delivery_estimate: string | null; is_active: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bulk, setBulk] = useState("");
  const [rows, setRows] = useState<Row[]>(() =>
    UFS.map(({ uf }) => {
      const r = initial.find((x) => x.uf === uf);
      return {
        uf,
        enabled: Boolean(r),
        price: r ? centsToInput(r.price_cents) : "",
        estimate: r?.delivery_estimate ?? "",
        active: r?.is_active ?? true,
      };
    }),
  );
  const update = (uf: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.uf === uf ? { ...r, ...patch } : r)));

  const save = () => {
    const payload: { uf: string; priceCents: number; deliveryEstimate: string; isActive: boolean }[] = [];
    for (const r of rows.filter((x) => x.enabled)) {
      const cents = parseBRLToCents(r.price || "0");
      if (cents === null) return toast.error(`${r.uf}: valor de frete inválido.`);
      payload.push({ uf: r.uf, priceCents: cents, deliveryEstimate: r.estimate, isActive: r.active });
    }
    startTransition(async () => {
      const result = await saveShippingRates(payload);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-sm border border-line bg-paper p-4 sm:flex-row sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted">Aplicar um valor a todos os estados marcados</span>
          <input
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            inputMode="decimal"
            placeholder="Ex.: 24,90"
            className="min-h-11 w-40 rounded-sm border border-line-strong px-3"
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            if (parseBRLToCents(bulk) === null) return toast.error("Valor inválido.");
            setRows((list) => list.map((r) => (r.enabled ? { ...r, price: bulk } : r)));
          }}
        >
          Aplicar
        </Button>
        <Button variant="ghost" onClick={() => setRows((list) => list.map((r) => ({ ...r, enabled: true })))}>
          Marcar todos os estados
        </Button>
      </div>

      <div className="overflow-x-auto rounded-sm border border-line bg-paper">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Atende</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Frete (R$)</th>
              <th className="px-4 py-3 font-medium">Prazo exibido</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const name = UFS.find((u) => u.uf === r.uf)?.name ?? r.uf;
              return (
                <tr key={r.uf} className={`border-t border-line ${r.enabled ? "" : "text-muted"}`}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-ink"
                      checked={r.enabled}
                      onChange={(e) => update(r.uf, { enabled: e.target.checked })}
                      aria-label={`Atender ${name}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <span className="tabular font-medium">{r.uf}</span> <span className="text-muted">{name}</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={r.price}
                      disabled={!r.enabled}
                      onChange={(e) => update(r.uf, { price: e.target.value })}
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-label={`Frete para ${name}`}
                      className="min-h-10 w-28 rounded-sm border border-line-strong px-2 disabled:bg-cream"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={r.estimate}
                      disabled={!r.enabled}
                      maxLength={60}
                      onChange={(e) => update(r.uf, { estimate: e.target.value })}
                      placeholder="Ex.: 3 a 6 dias úteis"
                      aria-label={`Prazo para ${name}`}
                      className="min-h-10 w-52 rounded-sm border border-line-strong px-2 disabled:bg-cream"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-ink"
                      checked={r.active}
                      disabled={!r.enabled}
                      onChange={(e) => update(r.uf, { active: e.target.checked })}
                      aria-label={`Regra ativa para ${name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted">Estados sem regra ativa ficam bloqueados no checkout (o cliente vê a mensagem e não conclui o pedido).</p>
        <Button onClick={save} loading={pending}>
          Salvar frete
        </Button>
      </div>
    </div>
  );
}
