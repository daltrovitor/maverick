-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 07 · PERSONALIZADOS, DIMONA E PAGAMENTO EMBUTIDO
-- · Boné personalizado: pedido com arte (bucket privado) e preço com desconto por
--   quantidade configurado no painel (calculado sempre aqui, no banco).
-- · Dimona (impressão sob demanda): produto/variante vinculados a um SKU Dimona; o
--   pedido pago é repassado pela API e o status volta pelo webhook.
-- · Stripe Payment Element: cartão (crédito/débito) e Pix com QR Code dentro do site,
--   conciliados por PaymentIntent (substitui o redirecionamento ao Stripe Checkout).
-- =====================================================================================

-- =====================================================================================
-- CONFIGURAÇÕES
-- =====================================================================================
alter table public.store_settings
  -- stripe: QR Code gerado pelo Stripe e confirmado automaticamente · manual: BR Code estático.
  add column pix_provider text not null default 'stripe' check (pix_provider in ('stripe', 'manual')),
  add column custom_enabled boolean not null default true,
  -- Preço base por boné personalizado; sem preço, a calculadora mostra "sob consulta".
  add column custom_unit_price_cents int check (custom_unit_price_cents is null or custom_unit_price_cents between 100 and 1000000),
  add column custom_min_quantity int not null default 1 check (custom_min_quantity between 1 and 10000),
  add column custom_max_quantity int not null default 1000 check (custom_max_quantity between 1 and 100000),
  -- A cada `custom_step_units` unidades, `custom_step_bps` de desconto (500 = 5%) sobre todas.
  add column custom_step_units int not null default 10 check (custom_step_units between 1 and 10000),
  add column custom_step_bps int not null default 500 check (custom_step_bps between 0 and 9000),
  add column custom_max_discount_bps int not null default 3000 check (custom_max_discount_bps between 0 and 9000),
  add column dimona_auto_forward boolean not null default true,
  add column dimona_shipping_speed text not null default 'pac' check (dimona_shipping_speed in ('pac', 'sedex')),
  add constraint store_settings_custom_quantity_range check (custom_max_quantity >= custom_min_quantity);

grant update (
  pix_provider, custom_enabled, custom_unit_price_cents, custom_min_quantity, custom_max_quantity,
  custom_step_units, custom_step_bps, custom_max_discount_bps, dimona_auto_forward, dimona_shipping_speed
) on public.store_settings to authenticated;

-- =====================================================================================
-- DIMONA: vínculo de produto e variante
-- =====================================================================================
alter table public.products
  add column fulfillment text not null default 'stock' check (fulfillment in ('stock', 'dimona'));

alter table public.product_variants
  add column dimona_sku_id text check (dimona_sku_id is null or dimona_sku_id ~ '^[A-Za-z0-9._-]{1,40}$');

-- Artes e mockups enviados à Dimona. Tabela só do painel: os arquivos de impressão não
-- ficam expostos na leitura pública do catálogo.
create table public.product_dimona (
  product_id uuid primary key references public.products (id) on delete cascade,
  -- {"front": "https://...", "back": "https://..."} (lados aceitos pela API v3 da Dimona)
  designs jsonb not null default '{}'::jsonb check (jsonb_typeof(designs) = 'object'),
  mocks jsonb not null default '{}'::jsonb check (jsonb_typeof(mocks) = 'object'),
  updated_at timestamptz not null default now()
);

create trigger product_dimona_set_updated_at
  before update on public.product_dimona
  for each row execute function public.set_updated_at();

alter table public.product_dimona enable row level security;
create policy product_dimona_admin_all on public.product_dimona
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.product_dimona from anon, authenticated;
grant select, insert, update, delete on public.product_dimona to authenticated;
grant all on public.product_dimona to service_role;

-- =====================================================================================
-- PEDIDOS: documento do cliente, Pix pelo Stripe e acompanhamento da Dimona
-- =====================================================================================
alter table public.orders
  add column customer_document text check (customer_document is null or customer_document ~ '^[0-9]{11}$'),
  add column pix_provider text check (pix_provider is null or pix_provider in ('stripe', 'manual')),
  add column pix_qr_data text check (pix_qr_data is null or char_length(pix_qr_data) <= 1000),
  add column pix_qr_expires_at timestamptz,
  add column dimona_order_id text unique check (dimona_order_id is null or char_length(dimona_order_id) between 1 and 40),
  add column dimona_status text check (dimona_status is null or char_length(dimona_status) <= 80),
  add column dimona_status_id int,
  add column dimona_tracking_url text check (
    dimona_tracking_url is null or (dimona_tracking_url ~* '^https?://[^\s]+$' and char_length(dimona_tracking_url) <= 500)
  ),
  add column dimona_sent_at timestamptz,
  add column dimona_updated_at timestamptz,
  add column dimona_last_error text check (dimona_last_error is null or char_length(dimona_last_error) <= 1000);

create unique index orders_payment_intent_unique on public.orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.order_events drop constraint order_events_type_check;
alter table public.order_events add constraint order_events_type_check check (type in (
  'created', 'pix_confirmed', 'pix_rejected', 'card_paid', 'card_failed',
  'status_changed', 'expired', 'stock_conflict', 'note',
  'payment_attempt_failed', 'dimona_sent', 'dimona_failed', 'dimona_status'
));
alter table public.order_events drop constraint order_events_actor_kind_check;
alter table public.order_events add constraint order_events_actor_kind_check
  check (actor_kind in ('system', 'admin', 'customer', 'stripe', 'dimona'));

-- =====================================================================================
-- CRIAÇÃO DO PEDIDO (CPF do cliente e provedor do Pix congelados no pedido)
-- =====================================================================================
create or replace function public.create_order(p jsonb, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_existing record;
  v_settings public.store_settings%rowtype;
  v_method text := p ->> 'payment_method';
  v_name text := btrim(coalesce(p -> 'customer' ->> 'name', ''));
  v_email text := lower(btrim(coalesce(p -> 'customer' ->> 'email', '')));
  v_phone text := coalesce(p -> 'customer' ->> 'phone', '');
  v_document text := nullif(regexp_replace(coalesce(p -> 'customer' ->> 'document', ''), '[^0-9]', '', 'g'), '');
  v_addr jsonb := p -> 'address';
  v_uf text := upper(coalesce(p -> 'address' ->> 'uf', ''));
  v_cart jsonb;
  v_total int;
  v_order_id uuid;
  v_number int;
  v_token text;
  v_expires timestamptz;
  v_constraint text;
begin
  if v_key is null then
    perform public._fail('invalid_input', 'idempotency_key');
  end if;

  select o.id, o.number, o.public_token, o.total_cents, o.payment_method, o.status, o.expires_at
  into v_existing
  from public.orders o
  where o.idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'id', v_existing.id, 'number', v_existing.number, 'public_token', v_existing.public_token,
      'total_cents', v_existing.total_cents, 'payment_method', v_existing.payment_method,
      'status', v_existing.status, 'expires_at', v_existing.expires_at, 'replayed', true
    );
  end if;

  select * into v_settings from public.store_settings where id;
  if v_method = 'pix' then
    if v_settings.pix_provider = 'manual'
       and (v_settings.pix_key is null or v_settings.pix_holder_name is null or v_settings.pix_city is null) then
      perform public._fail('pix_unavailable');
    end if;
  elsif v_method = 'card' then
    if not v_settings.card_enabled then
      perform public._fail('card_unavailable');
    end if;
  else
    perform public._fail('invalid_input', 'payment_method');
  end if;

  if char_length(v_name) not between 3 and 120 then perform public._fail('invalid_input', 'customer.name'); end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then perform public._fail('invalid_input', 'customer.email'); end if;
  if v_phone !~ '^55[0-9]{10,11}$' then perform public._fail('invalid_input', 'customer.phone'); end if;
  if v_document is not null and not public.is_valid_cpf(v_document) then perform public._fail('invalid_input', 'customer.document'); end if;
  if v_addr is null or jsonb_typeof(v_addr) <> 'object' then perform public._fail('invalid_input', 'address'); end if;
  if coalesce(v_addr ->> 'cep', '') !~ '^[0-9]{8}$' then perform public._fail('invalid_input', 'address.cep'); end if;
  if char_length(btrim(coalesce(v_addr ->> 'street', ''))) not between 2 and 120 then perform public._fail('invalid_input', 'address.street'); end if;
  if char_length(btrim(coalesce(v_addr ->> 'number', ''))) not between 1 and 20 then perform public._fail('invalid_input', 'address.number'); end if;
  if char_length(coalesce(v_addr ->> 'complement', '')) > 60 then perform public._fail('invalid_input', 'address.complement'); end if;
  if char_length(btrim(coalesce(v_addr ->> 'district', ''))) not between 2 and 80 then perform public._fail('invalid_input', 'address.district'); end if;
  if char_length(btrim(coalesce(v_addr ->> 'city', ''))) not between 2 and 80 then perform public._fail('invalid_input', 'address.city'); end if;
  if not public.is_valid_uf(v_uf) then perform public._fail('invalid_input', 'address.uf'); end if;
  if char_length(coalesce(p ->> 'notes', '')) > 500 then perform public._fail('invalid_input', 'notes'); end if;

  begin
    v_cart := public._compute_cart(p -> 'items', v_uf, p ->> 'coupon_code', v_email, true);
    v_total := (v_cart ->> 'total_cents')::int;

    -- Mínimo do Stripe em BRL (R$ 0,50) vale para cartão e para o Pix gerado pelo Stripe.
    if v_total < 50 and (v_method = 'card' or v_settings.pix_provider = 'stripe') then
      perform public._fail('amount_too_low');
    end if;

    -- Reserva do estoque (as linhas já estão travadas por _compute_cart).
    update public.product_variants v
    set stock = v.stock - (l ->> 'quantity')::int
    from jsonb_array_elements(v_cart -> 'lines') as l
    where v.id = (l ->> 'variant_id')::uuid;

    v_expires := case
      when v_method = 'pix' then now() + make_interval(hours => v_settings.pix_expiration_hours)
      else now() + interval '2 hours'
    end;

    insert into public.orders (
      idempotency_key, user_id, status, payment_method, payment_status, pix_provider,
      customer_name, customer_email, customer_phone, customer_document,
      shipping_address, shipping_uf, shipping_cents, shipping_estimate, cep_verified,
      subtotal_cents, discount_cents, total_cents, coupon_id, coupon_code,
      customer_notes, expires_at
    ) values (
      v_key, p_user_id, 'awaiting_payment', v_method, 'pending',
      case when v_method = 'pix' then v_settings.pix_provider end,
      v_name, v_email, v_phone, v_document,
      jsonb_build_object(
        'cep', v_addr ->> 'cep',
        'street', btrim(v_addr ->> 'street'),
        'number', btrim(v_addr ->> 'number'),
        'complement', nullif(btrim(coalesce(v_addr ->> 'complement', '')), ''),
        'district', btrim(v_addr ->> 'district'),
        'city', btrim(v_addr ->> 'city'),
        'uf', v_uf
      ),
      v_uf,
      (v_cart ->> 'shipping_cents')::int,
      v_cart ->> 'shipping_estimate',
      coalesce((p ->> 'cep_verified')::boolean, false),
      (v_cart ->> 'subtotal_cents')::int,
      (v_cart ->> 'discount_cents')::int,
      v_total,
      (v_cart ->> 'coupon_id')::uuid,
      v_cart ->> 'coupon_code',
      nullif(btrim(coalesce(p ->> 'notes', '')), ''),
      v_expires
    )
    returning id, number, public_token into v_order_id, v_number, v_token;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_label, sku, image_path, unit_price_cents, quantity
    )
    select
      v_order_id,
      (l ->> 'product_id')::uuid,
      (l ->> 'variant_id')::uuid,
      l ->> 'product_name',
      l ->> 'variant_label',
      l ->> 'sku',
      l ->> 'image_path',
      (l ->> 'unit_price_cents')::int,
      (l ->> 'quantity')::int
    from jsonb_array_elements(v_cart -> 'lines') as l;

    if v_cart ->> 'coupon_id' is not null then
      insert into public.coupon_redemptions (coupon_id, order_id, customer_key, discount_cents)
      values ((v_cart ->> 'coupon_id')::uuid, v_order_id, v_email, (v_cart ->> 'discount_cents')::int);
      update public.coupons set uses_count = uses_count + 1 where id = (v_cart ->> 'coupon_id')::uuid;
    end if;

    insert into public.order_events (order_id, type, to_status, actor_kind, actor_id, message)
    values (v_order_id, 'created', 'awaiting_payment', 'customer', p_user_id,
            case when v_method = 'pix' then 'Pedido criado: aguardando Pix' else 'Pedido criado: aguardando cartão' end);
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_idempotency_key_key' then
        -- Requisição concorrente com a mesma chave: devolve o pedido já criado.
        select o.id, o.number, o.public_token, o.total_cents, o.payment_method, o.status, o.expires_at
        into v_existing
        from public.orders o
        where o.idempotency_key = v_key;
        return jsonb_build_object(
          'id', v_existing.id, 'number', v_existing.number, 'public_token', v_existing.public_token,
          'total_cents', v_existing.total_cents, 'payment_method', v_existing.payment_method,
          'status', v_existing.status, 'expires_at', v_existing.expires_at, 'replayed', true
        );
      end if;
      raise;
  end;

  return jsonb_build_object(
    'id', v_order_id, 'number', v_number, 'public_token', v_token,
    'total_cents', v_total, 'payment_method', v_method,
    'status', 'awaiting_payment', 'expires_at', v_expires, 'replayed', false
  );
end;
$$;

-- =====================================================================================
-- STRIPE · PaymentIntent (Payment Element)
-- =====================================================================================
-- Vincula o PaymentIntent ao pedido (e o QR Code, no Pix). Um novo PaymentIntent
-- substitui o anterior: eventos do antigo passam a ser ignorados.
create or replace function public.attach_payment_intent(
  p_order_id uuid,
  p_payment_intent_id text,
  p_pix_qr_data text default null,
  p_pix_qr_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$' then
    perform public._fail('invalid_input', 'payment_intent');
  end if;
  update public.orders
  set stripe_payment_intent_id = p_payment_intent_id,
      pix_qr_data = case when payment_method = 'pix' then coalesce(p_pix_qr_data, pix_qr_data) else null end,
      pix_qr_expires_at = case when payment_method = 'pix' then coalesce(p_pix_qr_expires_at, pix_qr_expires_at) else null end
  where id = p_order_id
    and status = 'awaiting_payment'
    and (payment_method = 'card' or pix_provider = 'stripe');
  if not found then
    perform public._fail('invalid_transition', 'attach_payment_intent');
  end if;
end;
$$;

-- Aplica um resultado de PaymentIntent uma única vez (idempotência por id do evento).
-- p_outcome: 'paid' | 'failed' | 'canceled'
create or replace function public.process_payment_intent_event(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_payment_intent_id text,
  p_outcome text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_result text;
begin
  insert into public.stripe_events (id, type, order_id, outcome)
  values (p_event_id, p_event_type, p_order_id, 'processing')
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found or o.stripe_payment_intent_id is distinct from p_payment_intent_id then
    v_result := 'ignored';
  elsif p_outcome = 'paid' then
    -- SQL não garante curto-circuito: a reserva (com efeito colateral) fica num IF próprio.
    v_result := null;
    if o.payment_status = 'paid' then
      v_result := 'already_paid';
    elsif o.status in ('expired', 'canceled') then
      if not public._reserve_order_stock(o.id) then
        update public.orders
        set status = 'paid', payment_status = 'paid', paid_at = now(), canceled_at = null
        where id = o.id;
        insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
        values (o.id, 'stock_conflict', o.status, 'paid', 'stripe',
                'Pagamento confirmado após o prazo e sem estoque disponível: avaliar reembolso no Stripe.');
        v_result := 'stock_conflict';
      end if;
    end if;

    if v_result is null then
      update public.orders
      set status = 'paid', payment_status = 'paid', paid_at = now(), canceled_at = null
      where id = o.id;
      insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
      values (o.id,
              case when o.payment_method = 'pix' then 'pix_confirmed' else 'card_paid' end,
              o.status, 'paid', 'stripe',
              case when o.payment_method = 'pix' then 'Pix recebido e confirmado automaticamente pelo Stripe.'
                   else 'Pagamento com cartão aprovado.' end);
      v_result := 'paid';
    end if;
  elsif p_outcome = 'failed' then
    if o.status <> 'awaiting_payment' then
      v_result := 'ignored';
    elsif o.payment_method = 'card' then
      -- Cartão recusado: o PaymentIntent continua aberto e o cliente pode tentar outro cartão.
      insert into public.order_events (order_id, type, actor_kind, message)
      values (o.id, 'payment_attempt_failed', 'stripe', 'Tentativa de pagamento recusada; o cliente pode tentar de novo.');
      v_result := 'attempt_failed';
    else
      -- Pix do Stripe: o QR Code expirou sem pagamento.
      perform public._release_order_stock(o.id);
      update public.orders
      set status = 'expired', payment_status = 'expired', canceled_at = now()
      where id = o.id;
      insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
      values (o.id, 'expired', o.status, 'expired', 'stripe', 'O código Pix expirou sem pagamento; estoque devolvido.');
      v_result := 'expired';
    end if;
  elsif p_outcome = 'canceled' then
    if o.status = 'awaiting_payment' then
      perform public._release_order_stock(o.id);
      update public.orders
      set status = 'canceled', payment_status = 'canceled', canceled_at = now()
      where id = o.id;
      insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
      values (o.id, 'card_failed', o.status, 'canceled', 'stripe', 'Pagamento cancelado no Stripe; estoque devolvido.');
      v_result := 'canceled';
    else
      v_result := 'ignored';
    end if;
  else
    v_result := 'ignored';
  end if;

  update public.stripe_events set outcome = v_result where id = p_event_id;
  return v_result;
end;
$$;

-- =====================================================================================
-- DIMONA · registro do repasse e do status
-- =====================================================================================
create or replace function public.dimona_mark_sent(p_order_id uuid, p_dimona_id text, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set dimona_order_id = coalesce(nullif(btrim(coalesce(p_dimona_id, '')), ''), dimona_order_id),
      dimona_sent_at = coalesce(dimona_sent_at, now()),
      dimona_last_error = null
  where id = p_order_id;
  if not found then perform public._fail('not_found'); end if;
  insert into public.order_events (order_id, type, actor_kind, message)
  values (p_order_id, 'dimona_sent', 'system',
          left(coalesce(p_message, 'Pedido enviado para produção na Dimona.'), 1000));
end;
$$;

create or replace function public.dimona_mark_failed(p_order_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_error text := left(coalesce(nullif(btrim(coalesce(p_error, '')), ''), 'Falha desconhecida'), 1000);
begin
  update public.orders set dimona_last_error = v_error where id = p_order_id;
  if not found then perform public._fail('not_found'); end if;
  insert into public.order_events (order_id, type, actor_kind, message)
  values (p_order_id, 'dimona_failed', 'system', v_error);
end;
$$;

-- Atualização de status vinda do webhook da Dimona (ou da consulta manual no painel).
-- O pedido é localizado pelo id da Dimona ou, antes do primeiro retorno, pelo nosso
-- identificador enviado como order_id ("MAV-<número>").
create or replace function public.dimona_apply_status(
  p_dimona_id text,
  p_seller_id text,
  p_status_id int,
  p_status_name text,
  p_tracking_url text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  v_number int;
  v_name text := left(nullif(btrim(coalesce(p_status_name, '')), ''), 80);
  v_tracking text := nullif(btrim(coalesce(p_tracking_url, '')), '');
begin
  if v_tracking is not null and (v_tracking !~* '^https?://[^\s]+$' or char_length(v_tracking) > 500) then
    v_tracking := null;
  end if;

  select * into o from public.orders where dimona_order_id = btrim(coalesce(p_dimona_id, '')) for update;
  if not found and coalesce(p_seller_id, '') ~ '^MAV-[0-9]{1,9}$' then
    v_number := substr(p_seller_id, 5)::int;
    select * into o from public.orders where number = v_number for update;
  end if;
  if not found then
    return 'not_found';
  end if;

  if o.dimona_status is not distinct from v_name
     and o.dimona_status_id is not distinct from p_status_id
     and o.dimona_tracking_url is not distinct from coalesce(v_tracking, o.dimona_tracking_url) then
    return 'unchanged';
  end if;

  update public.orders
  set dimona_order_id = coalesce(dimona_order_id, nullif(btrim(coalesce(p_dimona_id, '')), '')),
      dimona_status = coalesce(v_name, dimona_status),
      dimona_status_id = coalesce(p_status_id, dimona_status_id),
      dimona_tracking_url = coalesce(v_tracking, dimona_tracking_url),
      dimona_updated_at = now()
  where id = o.id;

  insert into public.order_events (order_id, type, actor_kind, message)
  values (o.id, 'dimona_status', 'dimona', left('Dimona: ' || coalesce(v_name, 'status atualizado'), 1000));
  return 'updated';
end;
$$;

-- =====================================================================================
-- STATUS PELO PAINEL: Pix do Stripe pendente pode ser cancelado como o cartão
-- =====================================================================================
create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status text,
  p_tracking_code text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  o public.orders%rowtype;
  v_allowed boolean;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then perform public._fail('not_found'); end if;

  v_allowed := (o.status, p_status) in (
    ('paid', 'preparing'), ('paid', 'shipped'), ('paid', 'canceled'),
    ('preparing', 'shipped'), ('preparing', 'canceled'),
    ('shipped', 'delivered'),
    ('awaiting_payment', 'canceled')
  );
  if not v_allowed then
    perform public._fail('invalid_transition', o.status || '->' || coalesce(p_status, ''));
  end if;
  if o.status = 'awaiting_payment' and o.payment_method = 'pix' and coalesce(o.pix_provider, 'manual') = 'manual' then
    -- Pix manual pendente deve ser recusado (com motivo) pela ação própria; o Pix do Stripe pode ser cancelado.
    perform public._fail('invalid_transition', 'use_reject_pix');
  end if;

  if p_status = 'canceled' then
    perform public._release_order_stock(o.id);
  end if;

  update public.orders
  set status = p_status,
      payment_status = case when p_status = 'canceled' and o.payment_status = 'pending' then 'canceled' else payment_status end,
      tracking_code = case when p_status = 'shipped' then nullif(btrim(coalesce(p_tracking_code, '')), '') else tracking_code end,
      shipped_at = case when p_status = 'shipped' then now() else shipped_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      canceled_at = case when p_status = 'canceled' then now() else canceled_at end
  where id = o.id;

  insert into public.order_events (order_id, type, from_status, to_status, actor_kind, actor_id, message)
  values (o.id, 'status_changed', o.status, p_status, 'admin', v_admin,
          nullif(left(btrim(coalesce(p_note, '')), 1000), ''));

  return jsonb_build_object('id', o.id, 'status', p_status);
end;
$$;

-- =====================================================================================
-- CONSULTA PÚBLICA DO PEDIDO (inclui QR do Pix do Stripe e o rastreio da Dimona)
-- =====================================================================================
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'number', o.number,
    'status', o.status,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'pix_provider', o.pix_provider,
    'pix_qr_data', case when o.status = 'awaiting_payment' then o.pix_qr_data end,
    'pix_qr_expires_at', o.pix_qr_expires_at,
    'delivery_tracking_url', o.dimona_tracking_url,
    'customer_name', o.customer_name,
    'customer_email', o.customer_email,
    'shipping_address', o.shipping_address,
    'shipping_cents', o.shipping_cents,
    'shipping_estimate', o.shipping_estimate,
    'subtotal_cents', o.subtotal_cents,
    'discount_cents', o.discount_cents,
    'total_cents', o.total_cents,
    'coupon_code', o.coupon_code,
    'tracking_code', o.tracking_code,
    'expires_at', o.expires_at,
    'paid_at', o.paid_at,
    'created_at', o.created_at,
    'server_now', now(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'variant_label', i.variant_label,
        'image_path', i.image_path,
        'unit_price_cents', i.unit_price_cents,
        'quantity', i.quantity,
        'total_cents', i.total_cents
      ) order by i.product_name)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('type', e.type, 'to_status', e.to_status, 'created_at', e.created_at)
                       order by e.created_at)
      from public.order_events e
      where e.order_id = o.id
        and e.type not in ('note', 'payment_attempt_failed', 'dimona_sent', 'dimona_failed')
    ), '[]'::jsonb)
  )
  into v
  from public.orders o
  where o.public_token = p_token;

  return v;
end;
$$;

-- =====================================================================================
-- PRODUTOS (gravação atômica, agora com o vínculo Dimona)
-- =====================================================================================
create or replace function public.admin_save_product(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  v_id uuid := (p ->> 'id')::uuid;
  v_keep uuid[] := '{}';
  v_removed text[];
  v jsonb;
  v_vid uuid;
  v_fulfillment text := coalesce(p ->> 'fulfillment', 'stock');
begin
  if v_id is null then perform public._fail('invalid_input', 'id'); end if;
  if jsonb_typeof(p -> 'variants') <> 'array' or jsonb_array_length(p -> 'variants') = 0 then
    perform public._fail('product_needs_variant');
  end if;
  if jsonb_typeof(coalesce(p -> 'images', '[]'::jsonb)) <> 'array' then
    perform public._fail('invalid_input', 'images');
  end if;
  if v_fulfillment not in ('stock', 'dimona') then
    perform public._fail('invalid_input', 'fulfillment');
  end if;

  insert into public.products (
    id, slug, name, description, specs, category_id, status, is_featured, position, seo_title, seo_description, fulfillment
  ) values (
    v_id,
    p ->> 'slug',
    btrim(p ->> 'name'),
    coalesce(p ->> 'description', ''),
    coalesce(p -> 'specs', '[]'::jsonb),
    (p ->> 'category_id')::uuid,
    coalesce(p ->> 'status', 'draft'),
    coalesce((p ->> 'is_featured')::boolean, false),
    coalesce((p ->> 'position')::int, 0),
    nullif(btrim(coalesce(p ->> 'seo_title', '')), ''),
    nullif(btrim(coalesce(p ->> 'seo_description', '')), ''),
    v_fulfillment
  )
  on conflict (id) do update set
    slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    specs = excluded.specs,
    category_id = excluded.category_id,
    status = excluded.status,
    is_featured = excluded.is_featured,
    position = excluded.position,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    fulfillment = excluded.fulfillment;

  for v in select * from jsonb_array_elements(p -> 'variants') loop
    v_vid := (v ->> 'id')::uuid;
    if v_vid is not null and exists (select 1 from public.product_variants where id = v_vid and product_id = v_id) then
      update public.product_variants set
        sku = nullif(btrim(coalesce(v ->> 'sku', '')), ''),
        color = nullif(btrim(coalesce(v ->> 'color', '')), ''),
        size = nullif(btrim(coalesce(v ->> 'size', '')), ''),
        price_cents = (v ->> 'price_cents')::int,
        compare_at_cents = (v ->> 'compare_at_cents')::int,
        stock = (v ->> 'stock')::int,
        is_active = coalesce((v ->> 'is_active')::boolean, true),
        position = coalesce((v ->> 'position')::int, 0),
        dimona_sku_id = nullif(btrim(coalesce(v ->> 'dimona_sku_id', '')), '')
      where id = v_vid;
    else
      insert into public.product_variants (
        product_id, sku, color, size, price_cents, compare_at_cents, stock, is_active, position, dimona_sku_id
      )
      values (
        v_id,
        nullif(btrim(coalesce(v ->> 'sku', '')), ''),
        nullif(btrim(coalesce(v ->> 'color', '')), ''),
        nullif(btrim(coalesce(v ->> 'size', '')), ''),
        (v ->> 'price_cents')::int,
        (v ->> 'compare_at_cents')::int,
        (v ->> 'stock')::int,
        coalesce((v ->> 'is_active')::boolean, true),
        coalesce((v ->> 'position')::int, 0),
        nullif(btrim(coalesce(v ->> 'dimona_sku_id', '')), '')
      )
      returning id into v_vid;
    end if;
    v_keep := v_keep || v_vid;
  end loop;

  -- Variantes removidas: as já vendidas são apenas desativadas (preserva o histórico).
  update public.product_variants pv set is_active = false
  where pv.product_id = v_id and pv.id <> all (v_keep)
    and exists (select 1 from public.order_items oi where oi.variant_id = pv.id);
  delete from public.product_variants pv
  where pv.product_id = v_id and pv.id <> all (v_keep)
    and not exists (select 1 from public.order_items oi where oi.variant_id = pv.id);

  select coalesce(array_agg(storage_path), '{}') into v_removed
  from public.product_images
  where product_id = v_id
    and storage_path not in (
      select i ->> 'storage_path' from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) as i
    );

  delete from public.product_images where product_id = v_id;
  insert into public.product_images (product_id, storage_path, alt, color, position, width, height)
  select
    v_id,
    i ->> 'storage_path',
    left(coalesce(i ->> 'alt', ''), 160),
    nullif(btrim(coalesce(i ->> 'color', '')), ''),
    coalesce((i ->> 'position')::int, ord::int - 1),
    (i ->> 'width')::int,
    (i ->> 'height')::int
  from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) with ordinality as t(i, ord);

  if exists (
    select 1 from public.product_images
    where product_id = v_id and storage_path not like 'products/' || v_id::text || '/%'
  ) then
    perform public._fail('invalid_input', 'images.storage_path');
  end if;

  -- Artes da Dimona (guardadas mesmo se o produto voltar a ser de estoque próprio).
  if p ? 'dimona_designs' or p ? 'dimona_mocks' then
    insert into public.product_dimona (product_id, designs, mocks)
    values (v_id, coalesce(p -> 'dimona_designs', '{}'::jsonb), coalesce(p -> 'dimona_mocks', '{}'::jsonb))
    on conflict (product_id) do update set designs = excluded.designs, mocks = excluded.mocks;
  end if;

  if (select status from public.products where id = v_id) = 'active' then
    if not exists (select 1 from public.product_variants where product_id = v_id and is_active) then
      perform public._fail('product_needs_variant');
    end if;
    -- Produto Dimona publicado precisa de SKU em toda variante ativa e de ao menos uma arte.
    if v_fulfillment = 'dimona' and (
      exists (select 1 from public.product_variants where product_id = v_id and is_active and dimona_sku_id is null)
      or not exists (
        select 1 from public.product_dimona d
        where d.product_id = v_id and exists (select 1 from jsonb_object_keys(d.designs))
      )
    ) then
      perform public._fail('dimona_incomplete');
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'removed_paths', to_jsonb(v_removed), 'saved_by', v_admin);
end;
$$;

-- =====================================================================================
-- BONÉ PERSONALIZADO
-- =====================================================================================
create sequence public.custom_request_number_seq start with 101;

create table public.custom_cap_requests (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.custom_request_number_seq'),
  status text not null default 'new'
    check (status in ('new', 'quoted', 'approved', 'in_production', 'done', 'canceled')),
  customer_name text not null check (char_length(customer_name) between 3 and 120),
  customer_email text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(customer_email) <= 160),
  customer_phone text not null check (customer_phone ~ '^55[0-9]{10,11}$'),
  quantity int not null check (quantity between 1 and 100000),
  cap_model text not null check (cap_model in ('trucker', 'dad_hat', 'snapback', 'aba_reta', 'bucket', 'nao_sei')),
  cap_color text check (cap_color is null or char_length(cap_color) <= 60),
  technique text not null check (technique in ('bordado', 'estampa', 'patch', 'nao_sei')),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Arte no bucket privado "custom-designs" (enviada por URL assinada de uso único).
  design_path text not null check (design_path ~ '^requests/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  design_mime text not null check (design_mime in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  design_size int not null check (design_size between 1 and 10485760),
  -- Fotografia da calculadora no momento do pedido (o orçamento final é da equipe).
  unit_price_cents int check (unit_price_cents is null or unit_price_cents > 0),
  discount_bps int not null default 0 check (discount_bps between 0 and 10000),
  estimated_total_cents bigint check (estimated_total_cents is null or estimated_total_cents >= 0),
  privacy_consent_at timestamptz not null,
  ip_hash text check (ip_hash is null or char_length(ip_hash) = 64),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index custom_cap_requests_status_idx on public.custom_cap_requests (status, created_at desc);

create trigger custom_cap_requests_set_updated_at
  before update on public.custom_cap_requests
  for each row execute function public.set_updated_at();

alter table public.custom_cap_requests enable row level security;
create policy custom_requests_admin_read on public.custom_cap_requests
  for select to authenticated
  using (public.is_admin());
create policy custom_requests_admin_update on public.custom_cap_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.custom_cap_requests from anon, authenticated;
revoke all on sequence public.custom_request_number_seq from anon, authenticated;
grant select on public.custom_cap_requests to authenticated;
grant update (status, admin_notes, updated_by) on public.custom_cap_requests to authenticated;
grant all on public.custom_cap_requests to service_role;
grant usage, select on sequence public.custom_request_number_seq to service_role;

-- Desconto por quantidade: a cada `step_units` unidades, `step_bps` sobre TODAS as unidades,
-- limitado a `max_bps`. Espelhado em src/lib/custom-pricing.ts (a interface usa a mesma regra).
create or replace function public.custom_discount_bps(p_quantity int, p_step_units int, p_step_bps int, p_max_bps int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_quantity, 0) < 1 or coalesce(p_step_units, 0) < 1 then 0
    else least((p_quantity / p_step_units) * greatest(p_step_bps, 0), greatest(p_max_bps, 0))
  end;
$$;

create or replace function public.submit_custom_request(p jsonb, p_ip_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.store_settings%rowtype;
  v_qty int := (p ->> 'quantity')::int;
  v_bps int := 0;
  v_total bigint;
  v_id uuid;
  v_number int;
begin
  select * into s from public.store_settings where id;
  if not s.custom_enabled then
    perform public._fail('custom_unavailable');
  end if;
  if v_qty is null or v_qty < s.custom_min_quantity or v_qty > s.custom_max_quantity then
    perform public._fail('custom_quantity_range', s.custom_min_quantity || '-' || s.custom_max_quantity);
  end if;
  if coalesce((p ->> 'privacy_consent')::boolean, false) is not true then
    perform public._fail('invalid_input', 'consent');
  end if;

  v_bps := public.custom_discount_bps(v_qty, s.custom_step_units, s.custom_step_bps, s.custom_max_discount_bps);
  if s.custom_unit_price_cents is not null then
    -- Arredondamento ao centavo mais próximo (mesma conta da calculadora do site).
    v_total := (s.custom_unit_price_cents::bigint * v_qty * (10000 - v_bps) + 5000) / 10000;
  end if;

  insert into public.custom_cap_requests (
    customer_name, customer_email, customer_phone, quantity, cap_model, cap_color, technique, notes,
    design_path, design_mime, design_size, unit_price_cents, discount_bps, estimated_total_cents,
    privacy_consent_at, ip_hash
  ) values (
    btrim(p ->> 'name'),
    lower(btrim(p ->> 'email')),
    public._normalize_br_phone(p ->> 'phone'),
    v_qty,
    p ->> 'cap_model',
    nullif(btrim(coalesce(p ->> 'cap_color', '')), ''),
    p ->> 'technique',
    nullif(btrim(coalesce(p ->> 'notes', '')), ''),
    p ->> 'design_path',
    p ->> 'design_mime',
    (p ->> 'design_size')::int,
    s.custom_unit_price_cents,
    case when s.custom_unit_price_cents is null then 0 else v_bps end,
    v_total,
    now(),
    p_ip_hash
  )
  returning id, number into v_id, v_number;

  return jsonb_build_object(
    'id', v_id,
    'number', v_number,
    'unit_price_cents', s.custom_unit_price_cents,
    'discount_bps', case when s.custom_unit_price_cents is null then 0 else v_bps end,
    'estimated_total_cents', v_total
  );
end;
$$;

-- Bucket PRIVADO das artes enviadas pelos clientes (download só por URL assinada do painel).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'custom-designs',
  'custom-designs',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy custom_designs_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'custom-designs' and public.is_admin());

-- =====================================================================================
-- PRIVILÉGIOS DAS FUNÇÕES NOVAS (o padrão do Postgres/Supabase daria EXECUTE a todos)
-- =====================================================================================
revoke execute on function public.attach_payment_intent(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.process_payment_intent_event(text, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.dimona_mark_sent(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.dimona_mark_failed(uuid, text) from public, anon, authenticated;
revoke execute on function public.dimona_apply_status(text, text, int, text, text) from public, anon, authenticated;
revoke execute on function public.submit_custom_request(jsonb, text) from public, anon, authenticated;
revoke execute on function public.custom_discount_bps(int, int, int, int) from public, anon, authenticated;

grant execute on function public.attach_payment_intent(uuid, text, text, timestamptz) to service_role;
grant execute on function public.process_payment_intent_event(text, text, uuid, text, text) to service_role;
grant execute on function public.dimona_mark_sent(uuid, text, text) to service_role;
grant execute on function public.dimona_mark_failed(uuid, text) to service_role;
grant execute on function public.dimona_apply_status(text, text, int, text, text) to service_role;
grant execute on function public.submit_custom_request(jsonb, text) to service_role;
grant execute on function public.custom_discount_bps(int, int, int, int) to anon, authenticated, service_role;
