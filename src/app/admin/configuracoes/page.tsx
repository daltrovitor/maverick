// Hello World
import { SettingsForm } from "@/components/admin/SettingsForm";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { serverEnv, siteUrl } from "@/lib/env";
import { isDimonaConfigured } from "@/lib/dimona";
import { isEmailConfigured } from "@/lib/email";
import { isStripeConfigured, isStripeWebhookConfigured } from "@/lib/stripe";

export const metadata = { title: "Configurações" };

export default async function AdminSettings() {
  const { db } = await requireAdmin();
  const { data: settings } = await db.from("store_settings").select("*").maybeSingle();
  const env = serverEnv();
  const stripeMode = env.STRIPE_SECRET_KEY?.includes("_live_") ? "produção" : env.STRIPE_SECRET_KEY ? "teste" : null;

  return (
    <div>
      <AdminHeader title="Configurações" description="Dados da loja, Pix, cartão, personalizados, Dimona e políticas." />
      <Panel title="Conexões" className="mb-6">
        <ul className="grid gap-2 text-sm">
          <li className="flex flex-wrap items-center gap-2">
            Stripe:{" "}
            {isStripeConfigured() ? <Badge tone="positive">{`Conectado (${stripeMode})`}</Badge> : <Badge tone="negative">Não configurado</Badge>}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Webhook do Stripe (opcional):{" "}
            {isStripeWebhookConfigured() ? (
              <Badge tone="positive">Ativo</Badge>
            ) : (
              <Badge tone="neutral">Desligado: pagamentos conferidos direto no Stripe</Badge>
            )}
          </li>
          <li className="text-xs text-muted">
            Sem webhook, a confirmação acontece na página do pedido (atualiza sozinha), ao abrir Pedidos no painel, a cada
            compra nova e na rotina diária. Para confirmar mesmo com a página fechada, opcionalmente crie o webhook{" "}
            <code className="rounded-xs bg-cream px-1">{`${siteUrl}/api/webhooks/stripe`}</code> com payment_intent.succeeded,
            payment_intent.payment_failed e payment_intent.canceled.
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Dimona:{" "}
            {isDimonaConfigured() ? <Badge tone="positive">Chave configurada</Badge> : <Badge tone="waiting">Defina DIMONA_API_KEY</Badge>}
          </li>
          <li className="text-xs text-muted">
            Webhook da Dimona (enviado em cada pedido): <code className="rounded-xs bg-cream px-1">{`${siteUrl}/api/webhooks/dimona`}</code>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Avisos por e-mail (Resend):{" "}
            {isEmailConfigured() ? (
              <Badge tone="positive">{`Enviando para ${env.NOTIFY_EMAIL_TO}`}</Badge>
            ) : (
              <Badge tone="waiting">Defina RESEND_API_KEY</Badge>
            )}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Rotina de expiração (cron): {env.CRON_SECRET ? <Badge tone="positive">Protegida</Badge> : <Badge tone="waiting">Defina CRON_SECRET</Badge>}
          </li>
        </ul>
      </Panel>
      {settings ? <SettingsForm settings={settings} /> : <p className="text-sm text-danger">Configurações não encontradas no banco.</p>}
    </div>
  );
}
