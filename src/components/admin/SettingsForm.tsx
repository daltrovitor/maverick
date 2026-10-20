// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/admin/actions/store";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { centsToInput, formatBRL, parseBRLToCents } from "@/lib/br";
import { discountTiers, formatBps, parsePercentToBps } from "@/lib/custom-pricing";
import type { DimonaShippingSpeed, PixProvider, StoreSettingsRow } from "@/lib/database.types";

export function SettingsForm({ settings }: { readonly settings: StoreSettingsRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [s, setS] = useState({
    storeName: settings.store_name,
    contactEmail: settings.contact_email ?? "",
    whatsapp: settings.whatsapp?.replace(/^55/, "") ?? "",
    instagramUrl: settings.instagram_url ?? "",
    pixKey: settings.pix_key ?? "",
    pixKeyType: settings.pix_key_type ?? "",
    pixHolderName: settings.pix_holder_name ?? "",
    pixCity: settings.pix_city ?? "",
    pixExpirationHours: String(settings.pix_expiration_hours),
    pixProvider: settings.pix_provider ?? "stripe",
    cardEnabled: settings.card_enabled,
    customEnabled: settings.custom_enabled ?? true,
    customUnitPrice: settings.custom_unit_price_cents ? centsToInput(settings.custom_unit_price_cents) : "",
    customMinQuantity: String(settings.custom_min_quantity ?? 1),
    customMaxQuantity: String(settings.custom_max_quantity ?? 1000),
    customStepUnits: String(settings.custom_step_units ?? 10),
    customStepPercent: String((settings.custom_step_bps ?? 500) / 100).replace(".", ","),
    customMaxDiscountPercent: String((settings.custom_max_discount_bps ?? 3000) / 100).replace(".", ","),
    dimonaAutoForward: settings.dimona_auto_forward ?? true,
    dimonaShippingSpeed: settings.dimona_shipping_speed ?? "pac",
    announcement: settings.announcement ?? "",
    shippingPolicy: settings.shipping_policy ?? "",
    exchangePolicy: settings.exchange_policy ?? "",
  });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((prev) => ({ ...prev, [k]: v }));

  // Prévia das faixas com os valores digitados (mesma regra do site e do banco).
  const stepBps = parsePercentToBps(s.customStepPercent);
  const maxBps = parsePercentToBps(s.customMaxDiscountPercent);
  const unitCents = s.customUnitPrice.trim() ? parseBRLToCents(s.customUnitPrice) : null;
  const preview =
    stepBps !== null && maxBps !== null
      ? discountTiers({
          unitPriceCents: unitCents,
          minQuantity: Number.parseInt(s.customMinQuantity, 10) || 1,
          maxQuantity: Number.parseInt(s.customMaxQuantity, 10) || 1,
          stepUnits: Number.parseInt(s.customStepUnits, 10) || 1,
          stepBps,
          maxDiscountBps: maxBps,
        })
      : [];

  const submit = () => {
    if (s.customUnitPrice.trim() && (unitCents === null || unitCents < 100)) {
      toast.error("Personalizado: preço base inválido (mínimo R$ 1,00).");
      return;
    }
    if (stepBps === null || maxBps === null) {
      toast.error("Personalizado: use percentuais como 5 ou 2,5.");
      return;
    }
    // Campos em texto (R$ e %) seguem convertidos para centavos e pontos-base.
    const payload = { ...s, customUnitPriceCents: unitCents, customStepBps: stepBps, customMaxDiscountBps: maxBps };
    startTransition(async () => {
      const r = await saveSettings(payload);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.message);
    });
  };

  return (
    <form
      className="grid gap-6 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Panel title="Loja e atendimento">
        <div className="grid gap-4">
          <TextField label="Nome da loja" value={s.storeName} onChange={(e) => set("storeName", e.target.value)} required />
          <TextField label="E-mail de contato" type="email" value={s.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          <TextField label="WhatsApp de atendimento" type="tel" value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(62) 99999-0000" hint="Aparece no rodapé e no envio do comprovante Pix." />
          <TextField label="Instagram (link)" type="url" value={s.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="https://www.instagram.com/maverickcapshop/" />
          <TextField label="Aviso no topo do site" maxLength={140} value={s.announcement} onChange={(e) => set("announcement", e.target.value)} hint="Opcional. Ex.: frete especial, prazo de feriado." />
        </div>
      </Panel>

      <Panel title="Pix">
        <div className="grid gap-4">
          <SelectField label="Como o Pix é cobrado" value={s.pixProvider} onChange={(e) => set("pixProvider", e.target.value as PixProvider)}
            hint="Pelo Stripe, o QR Code sai com o valor exato e o pedido é confirmado sozinho. Exige o Pix ativado na conta Stripe; se falhar, o site usa a chave manual abaixo.">
            <option value="stripe">Pelo Stripe (confirmação automática)</option>
            <option value="manual">Chave Pix da loja (confirmação manual)</option>
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <SelectField label="Tipo de chave" value={s.pixKeyType} onChange={(e) => set("pixKeyType", e.target.value)}>
              <option value="">—</option>
              <option value="cnpj">CNPJ</option>
              <option value="cpf">CPF</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Aleatória</option>
            </SelectField>
            <TextField label="Chave Pix" value={s.pixKey} onChange={(e) => set("pixKey", e.target.value)} hint={s.pixKeyType === "phone" ? "Formato +5562999990000" : undefined} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nome do favorecido" maxLength={25} value={s.pixHolderName} onChange={(e) => set("pixHolderName", e.target.value.toUpperCase())} hint="Até 25 letras, sem acento (como aparece no banco)." />
            <TextField label="Cidade" maxLength={15} value={s.pixCity} onChange={(e) => set("pixCity", e.target.value.toUpperCase())} hint="Até 15 letras, sem acento." />
          </div>
          <TextField label="Reserva do pedido Pix (horas)" type="number" min={1} max={168} value={s.pixExpirationHours} onChange={(e) => set("pixExpirationHours", e.target.value)} hint="Sem confirmação nesse prazo, o pedido expira e o estoque volta." />
          <p className="text-xs text-muted">Chave manual: usada no modo manual e como reserva do Stripe. Confira o QR Code com um pagamento de teste antes de divulgar.</p>
        </div>
      </Panel>

      <Panel title="Cartão (Stripe)">
        <CheckboxField label="Aceitar cartão de crédito e débito" checked={s.cardEnabled} onChange={(e) => set("cardEnabled", e.target.checked)} />
        <p className="mt-2 text-xs text-muted">O formulário do cartão abre dentro do site (Stripe Payment Element). As chaves ficam nas variáveis de ambiente do servidor, nunca no painel.</p>
      </Panel>

      <Panel title="Boné personalizado (calculadora)">
        <div className="grid gap-4">
          <CheckboxField label="Receber pedidos de boné personalizado no site" checked={s.customEnabled} onChange={(e) => set("customEnabled", e.target.checked)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Preço base por boné (R$)" inputMode="decimal" placeholder="59,90" value={s.customUnitPrice}
              onChange={(e) => set("customUnitPrice", e.target.value)} hint="Vazio: a calculadora mostra “sob consulta”." />
            <TextField label="Quantidade mínima" type="number" min={1} value={s.customMinQuantity} onChange={(e) => set("customMinQuantity", e.target.value)} />
            <TextField label="Quantidade máxima" type="number" min={1} value={s.customMaxQuantity} onChange={(e) => set("customMaxQuantity", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="A cada (unidades)" type="number" min={1} value={s.customStepUnits} onChange={(e) => set("customStepUnits", e.target.value)} />
            <TextField label="Desconto por faixa (%)" inputMode="decimal" value={s.customStepPercent} onChange={(e) => set("customStepPercent", e.target.value)} />
            <TextField label="Desconto máximo (%)" inputMode="decimal" value={s.customMaxDiscountPercent} onChange={(e) => set("customMaxDiscountPercent", e.target.value)} />
          </div>
          <p className="text-xs leading-relaxed text-muted">
            O desconto vale para todas as unidades do pedido. Ex.: a cada 10 unidades, 5% — com 25 bonés o cliente ganha 10% em todos.
          </p>
          {preview.length > 0 ? (
            <ul className="grid gap-1 rounded-xs bg-cream p-3 text-xs text-ink-soft sm:grid-cols-2">
              {preview.map((t) => (
                <li key={t.quantity} className="tabular">
                  {t.quantity}+ un. · {formatBps(t.discountBps)}
                  {unitCents ? ` · ${formatBRL(Math.round((unitCents * (10000 - t.discountBps)) / 10000))}/un.` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Panel>

      <Panel title="Dimona (produção sob demanda)">
        <div className="grid gap-4">
          <CheckboxField label="Enviar automaticamente para a Dimona os pedidos pagos com produtos Dimona" checked={s.dimonaAutoForward}
            onChange={(e) => set("dimonaAutoForward", e.target.checked)} />
          <SelectField label="Modalidade de envio na Dimona" value={s.dimonaShippingSpeed} onChange={(e) => set("dimonaShippingSpeed", e.target.value as DimonaShippingSpeed)}>
            <option value="pac">PAC</option>
            <option value="sedex">SEDEX</option>
          </SelectField>
          <p className="text-xs leading-relaxed text-muted">
            O pedido entra na Dimona aguardando pagamento: pague pelo painel da Dimona depois de receber do cliente. Produtos são
            vinculados em Produtos → Produção (SKU Dimona por variante e link das artes).
          </p>
        </div>
      </Panel>

      <Panel title="Políticas exibidas no site">
        <div className="grid gap-4">
          <TextAreaField label="Envios e prazos" rows={6} maxLength={8000} value={s.shippingPolicy} onChange={(e) => set("shippingPolicy", e.target.value)} />
          <TextAreaField label="Trocas e devoluções" rows={6} maxLength={8000} value={s.exchangePolicy} onChange={(e) => set("exchangePolicy", e.target.value)} />
        </div>
      </Panel>

      <div className="xl:col-span-2">
        <Button type="submit" size="lg" loading={pending}>
          Salvar configurações
        </Button>
      </div>
    </form>
  );
}
