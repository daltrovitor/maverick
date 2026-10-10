// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCoupon, toggleCoupon } from "@/app/admin/actions/store";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextField } from "@/components/ui/Field";
import { formatBRL, parseBRLToCents } from "@/lib/br";
import type { CouponRow } from "@/lib/database.types";

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/** "2026-10-10T14:30" (input datetime-local, horário de Brasília) → ISO com offset. */
function localToIso(value: string): string | null {
  if (!value) return null;
  return `${value}:00-03:00`;
}

export function CouponManager({
  coupons,
  affiliateNames,
  serverNow,
}: {
  readonly coupons: CouponRow[];
  readonly affiliateNames: Record<string, string>;
  readonly serverNow: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    code: "",
    description: "",
    kind: "percent" as "percent" | "fixed",
    value: "",
    minSubtotal: "",
    maxUses: "",
    maxPerCustomer: "1",
    startsAt: "",
    expiresAt: "",
    isActive: true,
  });

  const create = () => {
    const value = form.kind === "percent" ? Number.parseInt(form.value, 10) : parseBRLToCents(form.value);
    if (!value || value <= 0) return toast.error("Informe o valor do desconto.");
    const minSubtotal = form.minSubtotal ? parseBRLToCents(form.minSubtotal) : 0;
    if (minSubtotal === null) return toast.error("Valor mínimo inválido.");
    startTransition(async () => {
      const result = await saveCoupon({
        code: form.code,
        description: form.description,
        kind: form.kind,
        value,
        minSubtotalCents: minSubtotal,
        maxUses: form.maxUses ? Number.parseInt(form.maxUses, 10) : null,
        maxUsesPerCustomer: Number.parseInt(form.maxPerCustomer, 10) || 1,
        startsAt: localToIso(form.startsAt) ?? new Date().toISOString(),
        expiresAt: localToIso(form.expiresAt),
        isActive: form.isActive,
      });
      if (result.ok) {
        toast.success(result.message);
        setForm((f) => ({ ...f, code: "", description: "", value: "" }));
        router.refresh();
      } else toast.error(result.message);
    });
  };

  const now = new Date(serverNow);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        {coupons.length === 0 ? (
          <p className="rounded-sm border border-dashed border-line-strong bg-paper px-5 py-10 text-center text-sm text-muted">Nenhum cupom criado.</p>
        ) : (
          <ul className="grid gap-3">
            {coupons.map((c) => {
              const expired = c.expires_at ? new Date(c.expires_at) <= now : false;
              const notStarted = new Date(c.starts_at) > now;
              const exhausted = c.max_uses !== null && c.uses_count >= c.max_uses;
              const tone = !c.is_active || expired || exhausted ? "neutral" : notStarted ? "waiting" : "positive";
              const label = !c.is_active ? "Inativo" : expired ? "Expirado" : exhausted ? "Esgotado" : notStarted ? "Agendado" : "Valendo";
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-sm border border-line bg-paper p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="tabular font-semibold">{c.code}</p>
                    <p className="text-sm text-ink-soft">
                      {c.kind === "percent" ? `${c.value}%` : formatBRL(c.value)} de desconto
                      {c.min_subtotal_cents > 0 ? ` · mínimo ${formatBRL(c.min_subtotal_cents)}` : ""} · {c.max_uses_per_customer} uso(s) por cliente
                      {c.max_uses ? ` · limite total ${c.max_uses}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {DATE.format(new Date(c.starts_at))} → {c.expires_at ? DATE.format(new Date(c.expires_at)) : "sem fim"} · usado {c.uses_count}×
                      {c.affiliate_application_id ? ` · afiliado: ${affiliateNames[c.affiliate_application_id] ?? "—"}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={tone}>{label}</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await toggleCoupon(c.id, !c.is_active);
                          if (r.ok) {
                            toast.success(r.message);
                            router.refresh();
                          } else toast.error(r.message);
                        })
                      }
                    >
                      {c.is_active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        className="grid content-start gap-4 rounded-sm border border-line bg-paper p-5"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <h2 className="text-sm font-semibold">Novo cupom</h2>
        <TextField label="Código" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EX.: BEMVINDO10" />
        <TextField label="Descrição interna" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Tipo" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "fixed" })}>
            <option value="percent">Percentual</option>
            <option value="fixed">Valor fixo</option>
          </SelectField>
          <TextField label={form.kind === "percent" ? "Percentual (%)" : "Valor (R$)"} required inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </div>
        <TextField label="Pedido mínimo (R$)" inputMode="decimal" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Limite total" type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} hint="Vazio = sem limite" />
          <TextField label="Usos por cliente" type="number" min={1} value={form.maxPerCustomer} onChange={(e) => setForm({ ...form, maxPerCustomer: e.target.value })} />
        </div>
        <TextField label="Início (horário de Brasília)" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} hint="Vazio = agora" />
        <TextField label="Fim (horário de Brasília)" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} hint="Vazio = sem prazo" />
        <CheckboxField label="Ativo" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        <Button type="submit" loading={pending}>
          Criar cupom
        </Button>
        <p className="text-xs text-muted">Um cupom por pedido (não acumulam). O desconto incide sobre os produtos, não sobre o frete.</p>
      </form>
    </div>
  );
}
