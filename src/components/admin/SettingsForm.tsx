// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/admin/actions/store";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import type { StoreSettingsRow } from "@/lib/database.types";

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
    cardEnabled: settings.card_enabled,
    announcement: settings.announcement ?? "",
    shippingPolicy: settings.shipping_policy ?? "",
    exchangePolicy: settings.exchange_policy ?? "",
  });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((prev) => ({ ...prev, [k]: v }));

  return (
    <form
      className="grid gap-6 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveSettings(s);
          if (r.ok) {
            toast.success(r.message);
            router.refresh();
          } else toast.error(r.message);
        });
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

      <Panel title="Pix (confirmação manual)">
        <div className="grid gap-4">
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
          <p className="text-xs text-muted">Sem chave configurada, o Pix fica indisponível no checkout. Confira o QR Code com um pagamento de teste antes de divulgar.</p>
        </div>
      </Panel>

      <Panel title="Cartão (Stripe)">
        <CheckboxField label="Aceitar cartão de crédito" checked={s.cardEnabled} onChange={(e) => set("cardEnabled", e.target.checked)} />
        <p className="mt-2 text-xs text-muted">As chaves do Stripe ficam nas variáveis de ambiente do servidor (nunca no painel). O status da conexão aparece ao lado.</p>
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
