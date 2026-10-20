# Personalizados, Dimona e pagamento embutido

Entrega de 20/10/2026. Este guia registra o pedido refinado, o que foi construído e como ligar cada integração em produção.

## Pedido refinado

> Na página inicial da Maverick Capshop, logo abaixo da seção "A coleção", crie a seção **"Crie seu boné"**:
> formulário com envio da arte (PNG/JPG/WEBP/PDF até 10 MB), modelo, cor, técnica, contato e consentimento LGPD.
> O pedido fica salvo no painel e chega por e-mail em **viraweb.online@gmail.com**.
> Ao lado, uma **calculadora** configurável no painel: preço base por boné e "X% de desconto a cada N unidades",
> aplicado sobre **todas** as unidades, com teto. Ex.: 5% a cada 10 un. → 25 bonés = 10% em todos.
>
> Integre a **API da Dimona** (impressão sob demanda): produtos da loja vinculados aos SKUs Dimona e, a cada venda
> paga, o pedido é criado automaticamente na Dimona (a loja paga a Dimona depois de receber do cliente). Status e
> rastreio voltam por webhook.
>
> Pagamentos sem sair do site: **cartão de crédito ou débito** pelo Stripe Payment Element (sem redirecionar para o
> Stripe Checkout) e **Pix com QR Code** no valor exato, confirmado automaticamente.
>
> Siga o Modelo Padrão já aplicado no projeto (composição tríptica herdada, fundo branco, sem exageros), teste,
> faça push direto na `main` e liste as variáveis de ambiente da Vercel.

## O que foi construído

| Parte | Onde |
| --- | --- |
| Seção "Crie seu boné" + calculadora | `src/components/landing/CustomCapSection.tsx`, regra em `src/lib/custom-pricing.ts` |
| Envio da arte (URL assinada direto ao Storage) e registro | `src/app/(site)/custom-actions.ts`, bucket privado `custom-designs` |
| Painel dos personalizados | `/admin/personalizados` |
| Configuração da calculadora, Pix e Dimona | `/admin/configuracoes` |
| Vínculo Dimona por produto (SKU por variante, artes) | `/admin/produtos/[id]` → painel "Produção" |
| Repasse automático do pedido pago + e-mail | `src/lib/order-fulfillment.ts`, `src/lib/dimona.ts` |
| Webhook da Dimona | `/api/webhooks/dimona` |
| Cartão embutido (Payment Element) | `src/components/checkout/StripeCardPayment.tsx` na página do pedido |
| Pix pelo Stripe com QR gerado pela loja | `src/lib/payments.ts` (`ensureStripePix`) |
| Banco | `supabase/migrations/20261020120000_custom_dimona_payments.sql` |

### Limite da API da Dimona

A API v2/v3 da Dimona (documentação em https://api.camisadimona.com.br/) cria pedidos, consulta status, rastreio,
cotação de frete e disponibilidade por SKU, mas **não lista os produtos da conta**. Por isso cada produto é cadastrado
na loja e vinculado no painel: em **Produção**, escolha "Dimona", informe o **SKU Dimona** de cada variante e os links
https das artes (frente/costas/laterais). Produto Dimona publicado sem SKU ou sem arte é bloqueado pelo banco.

## Colocando no ar

1. **Banco**: rode, em ordem, `supabase/migrations/20261020120000_custom_dimona_payments.sql` (cria o bucket
   privado `custom-designs`) e `supabase/migrations/20261021120000_stripe_without_webhook.sql` no Supabase
   (SQL Editor ou `supabase db push`).
2. **Stripe**
   - Em *Settings → Payment methods*, ative **Cards** e **Pix** (Pix exige conta brasileira e liberação do Stripe).
   - O webhook é **opcional**. Sem ele, a loja confirma consultando o Stripe: a página do pedido atualiza sozinha,
     e a conciliação roda ao abrir *Pedidos* no painel, a cada nova compra e na rotina diária (cron). Pedidos com
     cobrança no Stripe só expiram depois dessa conferência (migration 08), com a cobrança cancelada no Stripe.
   - Se quiser confirmação instantânea mesmo com a página fechada, crie o webhook
     `https://<domínio>/api/webhooks/stripe` com `payment_intent.succeeded`, `payment_intent.payment_failed` e
     `payment_intent.canceled`, e salve o segredo em `STRIPE_WEBHOOK_SECRET`.
   - Enquanto o Pix não for liberado, escolha "Chave Pix da loja" em *Configurações → Pix*.
3. **Dimona**: copie a chave da API da conta em camisadimona.com.br. O endereço do webhook vai em cada pedido
   automaticamente (`/api/webhooks/dimona`).
4. **Resend**: crie a conta com o e-mail que vai receber os avisos (viraweb.online@gmail.com). Sem domínio
   verificado, o remetente `onboarding@resend.dev` só entrega para o dono da conta; para outro remetente, verifique
   o domínio no Resend e ajuste `EMAIL_FROM`.
5. **Painel**: em *Configurações*, defina o preço base, a faixa e o desconto da calculadora.

## Variáveis de ambiente (Vercel)

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | sim (nova) | Payment Element no navegador (`pk_live_…`) |
| `STRIPE_SECRET_KEY` | sim | PaymentIntents no servidor (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | não | Só se usar o webhook (`whsec_…`); sem ele, a loja consulta o Stripe |
| `DIMONA_API_KEY` | sim (nova) | Criar/consultar pedidos e validar o webhook da Dimona |
| `RESEND_API_KEY` | sim (nova) | E-mails de pedido personalizado e de venda paga (`re_…`) |
| `NOTIFY_EMAIL_TO` | não | Destino dos avisos (padrão `viraweb.online@gmail.com`) |
| `EMAIL_FROM` | não | Remetente (padrão `Maverick Capshop <onboarding@resend.dev>`) |
| `DIMONA_API_BASE_URL` | não | Padrão `https://admin.camisadimona.com.br` |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IP_HASH_SALT`, `CRON_SECRET` | sim (já existentes) | Base da loja |
