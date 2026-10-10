-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 04 · REGRAS DE NEGÓCIO
-- Toda regra que envolve dinheiro, estoque, cupom ou permissão vive aqui, dentro de
-- transações. O app só valida a forma dos dados e chama estas funções.
--
-- Erros de negócio: SQLSTATE P0001 com a mensagem igual a um código estável
-- (ex.: 'insufficient_stock'), traduzido para português no app.
-- =====================================================================================

create or replace function public._fail(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using message = p_code, errcode = 'P0001', detail = coalesce(p_detail, '');
end;
$$;

create or replace function public._require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'forbidden', errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- =====================================================================================
-- CARRINHO: preços, frete e cupom calculados SEMPRE a partir do banco.
-- p_items: [{"variant_id": uuid, "quantity": int}]
-- =====================================================================================
create or replace function public._compute_cart(
  p_items jsonb,
  p_uf text,
  p_coupon_code text,
  p_customer_key text,
  p_lock boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_rate public.shipping_rates%rowtype;
  v_coupon public.coupons%rowtype;
  v_code text := upper(btrim(coalesce(p_coupon_code, '')));
  v_discount int := 0;
  v_used int;
  r record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform public._fail('cart_empty');
  end if;
  if jsonb_array_length(p_items) > 20 then
    perform public._fail('cart_too_large');
  end if;

  if p_lock then
    -- Ordem estável de travamento evita deadlocks entre compras simultâneas.
    perform 1
    from public.product_variants v
    where v.id in (select (e ->> 'variant_id')::uuid from jsonb_array_elements(p_items) as e)
    order by v.id
    for update;
  end if;

  for r in
    with req as (
      select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'quantity')::int) as qty
      from jsonb_array_elements(p_items) as e
      group by 1
    )
    select
      req.variant_id,
      req.qty,
      v.id as found_id,
      v.price_cents,
      v.stock,
      v.color,
      v.size,
      v.sku,
      v.is_active,
      p.id as product_id,
      p.name as product_name,
      p.status as product_status,
      (
        select i.storage_path
        from public.product_images i
        where i.product_id = p.id
        order by (i.color is not distinct from v.color) desc, i.position
        limit 1
      ) as image_path
    from req
    left join public.product_variants v on v.id = req.variant_id
    left join public.products p on p.id = v.product_id
    order by req.variant_id
  loop
    if r.qty is null or r.qty < 1 or r.qty > 20 then
      perform public._fail('invalid_quantity', r.variant_id::text);
    end if;
    if r.found_id is null or not r.is_active or r.product_status <> 'active' then
      perform public._fail('variant_unavailable', r.variant_id::text);
    end if;
    if r.stock < r.qty then
      perform public._fail('insufficient_stock', r.variant_id::text);
    end if;

    v_subtotal := v_subtotal + r.price_cents::bigint * r.qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', r.variant_id,
      'product_id', r.product_id,
      'product_name', r.product_name,
      'variant_label', nullif(concat_ws(' / ', r.color, r.size), ''),
      'sku', r.sku,
      'image_path', r.image_path,
      'unit_price_cents', r.price_cents,
      'quantity', r.qty,
      'available', r.stock
    ));
  end loop;

  if v_subtotal > 100000000 then
    perform public._fail('cart_too_large');
  end if;

  select * into v_rate from public.shipping_rates where uf = upper(coalesce(p_uf, '')) and is_active;
  if not found then
    perform public._fail('shipping_unavailable', upper(coalesce(p_uf, '')));
  end if;

  if v_code <> '' then
    if p_lock then
      select * into v_coupon from public.coupons where code = v_code for update;
    else
      select * into v_coupon from public.coupons where code = v_code;
    end if;
    if not found or not v_coupon.is_active then
      perform public._fail('coupon_invalid');
    end if;
    if v_coupon.starts_at > now() then
      perform public._fail('coupon_not_started');
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      perform public._fail('coupon_expired');
    end if;
    if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
      perform public._fail('coupon_exhausted');
    end if;
    if v_subtotal < v_coupon.min_subtotal_cents then
      perform public._fail('coupon_min_subtotal', v_coupon.min_subtotal_cents::text);
    end if;
    if p_customer_key is not null then
      select count(*) into v_used
      from public.coupon_redemptions cr
      where cr.coupon_id = v_coupon.id
        and cr.customer_key = p_customer_key
        and cr.released_at is null;
      if v_used >= v_coupon.max_uses_per_customer then
        perform public._fail('coupon_customer_limit');
      end if;
    end if;

    v_discount := case
      when v_coupon.kind = 'percent' then floor(v_subtotal * v_coupon.value / 100.0)::int
      else least(v_coupon.value::bigint, v_subtotal)::int
    end;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal_cents', v_subtotal,
    'shipping_uf', v_rate.uf,
    'shipping_cents', v_rate.price_cents,
    'shipping_estimate', v_rate.delivery_estimate,
    'coupon_id', case when v_code <> '' then v_coupon.id end,
    'coupon_code', case when v_code <> '' then v_coupon.code end,
    'discount_cents', v_discount,
    'total_cents', v_subtotal - v_discount + v_rate.price_cents
  );
end;
$$;

-- Prévia de valores para a interface (não reserva nada).
create or replace function public.quote_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._compute_cart(
    p -> 'items',
    p ->> 'uf',
    p ->> 'coupon_code',
    nullif(lower(btrim(coalesce(p ->> 'email', ''))), ''),
    false
  );
end;
$$;

-- =====================================================================================
-- ESTOQUE: devolução e nova reserva
-- =====================================================================================
create or replace function public._release_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon_id uuid;
begin
  update public.product_variants v
  set stock = v.stock + i.qty
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    group by oi.variant_id
  ) as i
  where v.id = i.variant_id;

  update public.coupon_redemptions
  set released_at = now()
  where order_id = p_order_id and released_at is null
  returning coupon_id into v_coupon_id;

  if v_coupon_id is not null then
    update public.coupons set uses_count = greatest(uses_count - 1, 0) where id = v_coupon_id;
  end if;
end;
$$;

-- Tenta reservar de novo o estoque de um pedido expirado/cancelado (pagamento tardio).
create or replace function public._reserve_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_short int;
  v_coupon_id uuid;
begin
  perform 1
  from public.product_variants v
  where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
  order by v.id
  for update;

  select count(*) into v_short
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = p_order_id
    group by oi.variant_id
  ) as i
  left join public.product_variants v on v.id = i.variant_id
  where v.id is null or v.stock < i.qty;

  if v_short > 0 then
    return false;
  end if;

  update public.product_variants v
  set stock = v.stock - i.qty
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = p_order_id
    group by oi.variant_id
  ) as i
  where v.id = i.variant_id;

  update public.coupon_redemptions
  set released_at = null
  where order_id = p_order_id and released_at is not null
  returning coupon_id into v_coupon_id;

  if v_coupon_id is not null then
    update public.coupons set uses_count = uses_count + 1 where id = v_coupon_id;
  end if;

  return true;
end;
$$;

-- =====================================================================================
-- CRIAÇÃO DO PEDIDO (somente service role; o servidor aplica validação e rate limit antes)
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
    if v_settings.pix_key is null or v_settings.pix_holder_name is null or v_settings.pix_city is null then
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

    if v_method = 'card' and v_total < 50 then
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
      idempotency_key, user_id, status, payment_method, payment_status,
      customer_name, customer_email, customer_phone,
      shipping_address, shipping_uf, shipping_cents, shipping_estimate, cep_verified,
      subtotal_cents, discount_cents, total_cents, coupon_id, coupon_code,
      customer_notes, expires_at
    ) values (
      v_key, p_user_id, 'awaiting_payment', v_method, 'pending',
      v_name, v_email, v_phone,
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

-- Expira pedidos não pagos no prazo e devolve o estoque.
create or replace function public.expire_stale_orders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select o.id
    from public.orders o
    where o.status = 'awaiting_payment' and o.expires_at < now()
    order by o.expires_at
    for update skip locked
  loop
    perform public._release_order_stock(r.id);
    update public.orders
    set status = 'expired', payment_status = 'expired', canceled_at = now()
    where id = r.id;
    insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
    values (r.id, 'expired', 'awaiting_payment', 'expired', 'system', 'Prazo de pagamento encerrado; estoque devolvido.');
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- =====================================================================================
-- PIX (confirmação manual pelo painel, com auditoria)
-- =====================================================================================
create or replace function public.admin_confirm_pix(p_order_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then perform public._fail('not_found'); end if;
  if o.payment_method <> 'pix' then perform public._fail('invalid_transition', o.payment_method); end if;

  if o.status = 'expired' then
    if not public._reserve_order_stock(o.id) then
      perform public._fail('insufficient_stock_to_reopen');
    end if;
  elsif o.status <> 'awaiting_payment' then
    perform public._fail('invalid_transition', o.status);
  end if;

  update public.orders
  set status = 'paid', payment_status = 'paid', paid_at = now(), canceled_at = null
  where id = o.id;

  insert into public.order_events (order_id, type, from_status, to_status, actor_kind, actor_id, message)
  values (o.id, 'pix_confirmed', o.status, 'paid', 'admin', v_admin,
          coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Pagamento Pix conferido e confirmado.'));

  return jsonb_build_object('id', o.id, 'status', 'paid');
end;
$$;

create or replace function public.admin_reject_pix(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  o public.orders%rowtype;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    perform public._fail('invalid_input', 'reason');
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then perform public._fail('not_found'); end if;
  if o.payment_method <> 'pix' or o.status <> 'awaiting_payment' then
    perform public._fail('invalid_transition', o.status);
  end if;

  perform public._release_order_stock(o.id);
  update public.orders
  set status = 'canceled', payment_status = 'rejected', canceled_at = now()
  where id = o.id;

  insert into public.order_events (order_id, type, from_status, to_status, actor_kind, actor_id, message)
  values (o.id, 'pix_rejected', o.status, 'canceled', 'admin', v_admin, left(btrim(p_reason), 1000));

  return jsonb_build_object('id', o.id, 'status', 'canceled');
end;
$$;

-- Avança o pedido após o pagamento: separação → envio → entrega, ou cancelamento.
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
  if o.status = 'awaiting_payment' and o.payment_method = 'pix' then
    -- Pix pendente deve ser recusado (com motivo) pela ação própria.
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
-- STRIPE
-- =====================================================================================
create or replace function public.attach_stripe_session(p_order_id uuid, p_session_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set stripe_checkout_session_id = p_session_id
  where id = p_order_id
    and payment_method = 'card'
    and (stripe_checkout_session_id is null or stripe_checkout_session_id = p_session_id);
  if not found then
    perform public._fail('invalid_transition', 'attach_session');
  end if;
end;
$$;

-- Aplica um evento verificado do Stripe uma única vez (idempotência por event.id).
-- p_outcome: 'paid' | 'failed' | 'expired'
create or replace function public.process_stripe_event(
  p_event_id text,
  p_event_type text,
  p_order_id uuid,
  p_session_id text,
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
  if not found or o.payment_method <> 'card'
     or (p_session_id is not null and o.stripe_checkout_session_id is distinct from p_session_id) then
    v_result := 'ignored';
  elsif p_outcome = 'paid' then
    -- SQL não garante curto-circuito: a reserva (com efeito colateral) fica num IF próprio.
    v_result := null;
    if o.payment_status = 'paid' then
      v_result := 'already_paid';
    elsif o.status in ('expired', 'canceled') then
      if not public._reserve_order_stock(o.id) then
        update public.orders
        set status = 'paid', payment_status = 'paid', paid_at = now(), canceled_at = null,
            stripe_payment_intent_id = p_payment_intent_id
        where id = o.id;
        insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
        values (o.id, 'stock_conflict', o.status, 'paid', 'stripe',
                'Pagamento confirmado após o prazo e sem estoque disponível: avaliar reembolso no Stripe.');
        v_result := 'stock_conflict';
      end if;
    end if;

    if v_result is null then
      update public.orders
      set status = 'paid', payment_status = 'paid', paid_at = now(), canceled_at = null,
          stripe_payment_intent_id = p_payment_intent_id
      where id = o.id;
      insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
      values (o.id, 'card_paid', o.status, 'paid', 'stripe', 'Pagamento com cartão aprovado.');
      v_result := 'paid';
    end if;
  elsif p_outcome in ('failed', 'expired') then
    if o.status = 'awaiting_payment' then
      perform public._release_order_stock(o.id);
      update public.orders
      set status = case when p_outcome = 'expired' then 'expired' else 'canceled' end,
          payment_status = case when p_outcome = 'expired' then 'expired' else 'failed' end,
          canceled_at = now()
      where id = o.id;
      insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
      values (o.id, 'card_failed', o.status,
              case when p_outcome = 'expired' then 'expired' else 'canceled' end, 'stripe',
              case when p_outcome = 'expired' then 'Sessão de pagamento expirada.' else 'Pagamento com cartão recusado.' end);
      v_result := p_outcome;
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
-- CONSULTA PÚBLICA DO PEDIDO (pelo link secreto)
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
      from public.order_events e where e.order_id = o.id and e.type <> 'note'
    ), '[]'::jsonb)
  )
  into v
  from public.orders o
  where o.public_token = p_token;

  return v;
end;
$$;

-- =====================================================================================
-- AFILIADOS
-- =====================================================================================
create or replace function public._normalize_br_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^[0-9]{10,11}$' then '55' || d
    when d ~ '^55[0-9]{10,11}$' then d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) as x;
$$;

create or replace function public.submit_affiliate_application(p jsonb, p_ip_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cpf text := regexp_replace(coalesce(p ->> 'cpf', ''), '[^0-9]', '', 'g');
  v_phone text := public._normalize_br_phone(p ->> 'phone');
  v_id uuid;
  v_token text;
  v_constraint text;
begin
  if not public.is_valid_cpf(v_cpf) then
    perform public._fail('affiliate_invalid_cpf');
  end if;
  if v_phone is null then
    perform public._fail('affiliate_invalid_phone');
  end if;
  if coalesce((p ->> 'followers_declared')::int, 0) < 1000 then
    perform public._fail('affiliate_followers_min');
  end if;
  if coalesce((p ->> 'truth_confirmed')::boolean, false) is not true
     or coalesce((p ->> 'privacy_consent')::boolean, false) is not true then
    perform public._fail('invalid_input', 'consent');
  end if;

  begin
    insert into public.affiliate_applications (
      full_name, cpf, phone, email, platform, profile_url, followers_declared,
      audience, sales_forecast_monthly, sales_forecast_basis, strategy, channels,
      truth_confirmed, privacy_consent_at, ip_hash
    ) values (
      btrim(p ->> 'full_name'),
      v_cpf,
      v_phone,
      lower(btrim(p ->> 'email')),
      p ->> 'platform',
      btrim(p ->> 'profile_url'),
      (p ->> 'followers_declared')::int,
      btrim(p ->> 'audience'),
      (p ->> 'sales_forecast_monthly')::int,
      btrim(p ->> 'sales_forecast_basis'),
      btrim(p ->> 'strategy'),
      array(select jsonb_array_elements_text(p -> 'channels')),
      true,
      now(),
      p_ip_hash
    )
    returning id, status_token into v_id, v_token;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'affiliate_cpf_phone_unique' then
        raise;
      end if;
      -- Registrada fora da subtransação desfeita: fica disponível para análise.
      insert into public.affiliate_attempts (cpf, phone, reason, existing_application_id, ip_hash)
      select v_cpf, v_phone, 'duplicate_pair', a.id, p_ip_hash
      from public.affiliate_applications a
      where a.cpf = v_cpf and a.phone = v_phone;
      return jsonb_build_object('error', 'affiliate_duplicate');
  end;

  return jsonb_build_object('id', v_id, 'status_token', v_token);
end;
$$;

create or replace function public.get_affiliate_status(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.affiliate_applications%rowtype;
  c public.coupons%rowtype;
  v_orders int := 0;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into a from public.affiliate_applications where status_token = p_token;
  if not found then
    return null;
  end if;

  select * into c
  from public.coupons
  where affiliate_application_id = a.id
  order by created_at desc
  limit 1;

  if c.id is not null then
    select count(*) into v_orders
    from public.orders o
    where o.coupon_id = c.id and o.status in ('paid', 'preparing', 'shipped', 'delivered');
  end if;

  return jsonb_build_object(
    'first_name', split_part(a.full_name, ' ', 1),
    'status', a.status,
    'created_at', a.created_at,
    'info_request_message', case when a.status = 'info_requested' then a.info_request_message end,
    'server_now', now(),
    'coupon', case when c.id is null then null else jsonb_build_object(
      'code', c.code,
      'value', c.value,
      'kind', c.kind,
      'starts_at', c.starts_at,
      'expires_at', c.expires_at,
      'is_active', c.is_active,
      'uses_count', c.uses_count,
      'paid_orders', v_orders
    ) end
  );
end;
$$;

create or replace function public.affiliate_respond(p_token text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 2000 then
    perform public._fail('invalid_input', 'message');
  end if;
  update public.affiliate_applications
  set applicant_response = btrim(p_message), status = 'pending'
  where status_token = p_token and status = 'info_requested';
  if not found then
    perform public._fail('invalid_transition');
  end if;
  return jsonb_build_object('status', 'pending');
end;
$$;

create or replace function public.admin_approve_affiliate(
  p_id uuid,
  p_followers_verified int,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  a public.affiliate_applications%rowtype;
  v_base text;
  v_code text;
  v_expires timestamptz := now() + interval '24 hours';
begin
  select * into a from public.affiliate_applications where id = p_id for update;
  if not found then perform public._fail('not_found'); end if;
  if a.status not in ('pending', 'info_requested') then
    perform public._fail('invalid_transition', a.status);
  end if;
  if p_followers_verified is null or p_followers_verified < 1000 then
    perform public._fail('affiliate_followers_min');
  end if;

  v_base := upper(left(regexp_replace(
    translate(split_part(a.full_name, ' ', 1),
              'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
              'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9]', '', 'g'), 8));
  if v_base = '' then v_base := 'AFILIADO'; end if;

  loop
    v_code := 'MAV-' || v_base || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    exit when not exists (select 1 from public.coupons where code = v_code);
  end loop;

  insert into public.coupons (
    code, description, kind, value, max_uses, max_uses_per_customer,
    starts_at, expires_at, affiliate_application_id, created_by
  ) values (
    v_code, left('Afiliado: ' || a.full_name, 200), 'percent', 25, null, 1,
    now(), v_expires, a.id, v_admin
  );

  update public.affiliate_applications
  set status = 'approved',
      followers_verified = p_followers_verified,
      admin_notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), admin_notes),
      reviewed_by = v_admin,
      reviewed_at = now()
  where id = a.id;

  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

create or replace function public.admin_reject_affiliate(p_id uuid, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
begin
  update public.affiliate_applications
  set status = 'rejected',
      admin_notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), admin_notes),
      reviewed_by = v_admin,
      reviewed_at = now()
  where id = p_id and status in ('pending', 'info_requested');
  if not found then perform public._fail('invalid_transition'); end if;
  return jsonb_build_object('status', 'rejected');
end;
$$;

create or replace function public.admin_request_affiliate_info(p_id uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
begin
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 1000 then
    perform public._fail('invalid_input', 'message');
  end if;
  update public.affiliate_applications
  set status = 'info_requested',
      info_request_message = btrim(p_message),
      applicant_response = null,
      reviewed_by = v_admin,
      reviewed_at = now()
  where id = p_id and status = 'pending';
  if not found then perform public._fail('invalid_transition'); end if;
  return jsonb_build_object('status', 'info_requested');
end;
$$;

-- =====================================================================================
-- PRODUTOS (gravação atômica de produto + variantes + imagens)
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
begin
  if v_id is null then perform public._fail('invalid_input', 'id'); end if;
  if jsonb_typeof(p -> 'variants') <> 'array' or jsonb_array_length(p -> 'variants') = 0 then
    perform public._fail('product_needs_variant');
  end if;
  if jsonb_typeof(coalesce(p -> 'images', '[]'::jsonb)) <> 'array' then
    perform public._fail('invalid_input', 'images');
  end if;

  insert into public.products (
    id, slug, name, description, specs, category_id, status, is_featured, position, seo_title, seo_description
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
    nullif(btrim(coalesce(p ->> 'seo_description', '')), '')
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
    seo_description = excluded.seo_description;

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
        position = coalesce((v ->> 'position')::int, 0)
      where id = v_vid;
    else
      insert into public.product_variants (product_id, sku, color, size, price_cents, compare_at_cents, stock, is_active, position)
      values (
        v_id,
        nullif(btrim(coalesce(v ->> 'sku', '')), ''),
        nullif(btrim(coalesce(v ->> 'color', '')), ''),
        nullif(btrim(coalesce(v ->> 'size', '')), ''),
        (v ->> 'price_cents')::int,
        (v ->> 'compare_at_cents')::int,
        (v ->> 'stock')::int,
        coalesce((v ->> 'is_active')::boolean, true),
        coalesce((v ->> 'position')::int, 0)
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

  if (select status from public.products where id = v_id) = 'active'
     and not exists (select 1 from public.product_variants where product_id = v_id and is_active) then
    perform public._fail('product_needs_variant');
  end if;

  return jsonb_build_object('id', v_id, 'removed_paths', to_jsonb(v_removed), 'saved_by', v_admin);
end;
$$;

create or replace function public.admin_delete_product(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  v_paths text[];
begin
  if exists (select 1 from public.order_items where product_id = p_id) then
    update public.products set status = 'archived' where id = p_id;
    return jsonb_build_object('archived', true, 'removed_paths', '[]'::jsonb, 'by', v_admin);
  end if;
  select coalesce(array_agg(storage_path), '{}') into v_paths from public.product_images where product_id = p_id;
  delete from public.products where id = p_id;
  if not found then perform public._fail('not_found'); end if;
  return jsonb_build_object('archived', false, 'removed_paths', to_jsonb(v_paths), 'by', v_admin);
end;
$$;

-- =====================================================================================
-- PAINEL: indicadores
-- =====================================================================================
create or replace function public.admin_dashboard(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin uuid := public._require_admin();
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  return jsonb_build_object(
    'since', v_since,
    'generated_by', v_admin,
    'paid_revenue_cents', coalesce((
      select sum(total_cents) from public.orders
      where paid_at >= v_since and status in ('paid', 'preparing', 'shipped', 'delivered')
    ), 0),
    'paid_orders', (
      select count(*) from public.orders
      where paid_at >= v_since and status in ('paid', 'preparing', 'shipped', 'delivered')
    ),
    'awaiting_pix', (select count(*) from public.orders where status = 'awaiting_payment' and payment_method = 'pix'),
    'to_ship', (select count(*) from public.orders where status in ('paid', 'preparing')),
    'stock_conflicts', (
      select count(*) from public.order_events e
      where e.type = 'stock_conflict' and e.created_at >= v_since
    ),
    'pending_affiliates', (select count(*) from public.affiliate_applications where status = 'pending'),
    'blocked_affiliate_attempts', (select count(*) from public.affiliate_attempts where created_at >= v_since),
    'by_method', coalesce((
      select jsonb_object_agg(payment_method, jsonb_build_object('orders', n, 'revenue_cents', rev))
      from (
        select payment_method, count(*) as n, sum(total_cents) as rev
        from public.orders
        where paid_at >= v_since and status in ('paid', 'preparing', 'shipped', 'delivered')
        group by payment_method
      ) as m
    ), '{}'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t order by t.quantity desc)
      from (
        select i.product_name, sum(i.quantity) as quantity, sum(i.total_cents) as revenue_cents
        from public.order_items i
        join public.orders o on o.id = i.order_id
        where o.paid_at >= v_since and o.status in ('paid', 'preparing', 'shipped', 'delivered')
        group by i.product_name
        order by 2 desc
        limit 5
      ) as t
    ), '[]'::jsonb),
    'low_stock', coalesce((
      select jsonb_agg(t)
      from (
        select p.id as product_id, p.name, nullif(concat_ws(' / ', v.color, v.size), '') as variant, v.stock
        from public.product_variants v
        join public.products p on p.id = v.product_id
        where v.is_active and p.status = 'active' and v.stock <= 3
        order by v.stock, p.name
        limit 10
      ) as t
    ), '[]'::jsonb),
    'affiliates', coalesce((
      select jsonb_agg(t order by t.revenue_cents desc)
      from (
        select a.id, a.full_name, c.code,
               count(o.id) filter (where o.status in ('paid', 'preparing', 'shipped', 'delivered')) as paid_orders,
               coalesce(sum(o.total_cents) filter (where o.status in ('paid', 'preparing', 'shipped', 'delivered')), 0) as revenue_cents
        from public.affiliate_applications a
        join public.coupons c on c.affiliate_application_id = a.id
        left join public.orders o on o.coupon_id = c.id
        where a.status = 'approved'
        group by a.id, a.full_name, c.code
      ) as t
    ), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================================
-- RATE LIMIT (janela fixa)
-- =====================================================================================
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;
