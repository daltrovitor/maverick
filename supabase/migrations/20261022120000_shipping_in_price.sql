-- Hello World
-- =====================================================================================
-- FRETE EMBUTIDO NO PREÇO
-- O valor cadastrado para cada UF passa a ser somado ao preço de CADA unidade: o cliente vê os
-- preços já ajustados pelo CEP e o pedido sai com "frete grátis" (shipping_cents = 0). Os itens
-- do pedido guardam o preço unitário já com o frete, então a soma dos itens bate com o subtotal.
-- Com a chave desligada volta o modelo anterior: frete cobrado à parte, uma vez por pedido.
-- UF sem regra ativa continua bloqueando o checkout nos dois modos.
-- =====================================================================================
alter table public.store_settings
  add column shipping_in_price boolean not null default true;

grant update (shipping_in_price) on public.store_settings to authenticated;

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
  v_units bigint := 0;
  v_rate public.shipping_rates%rowtype;
  v_in_price boolean;
  v_shipping int;
  v_included bigint := 0;
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
    v_units := v_units + r.qty;
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

  select * into v_rate from public.shipping_rates where uf = upper(coalesce(p_uf, '')) and is_active;
  if not found then
    perform public._fail('shipping_unavailable', upper(coalesce(p_uf, '')));
  end if;

  select s.shipping_in_price into v_in_price from public.store_settings s where s.id;
  v_shipping := v_rate.price_cents;
  if coalesce(v_in_price, false) then
    -- Frete embutido: cada unidade leva o valor da UF e o pedido sai sem frete à parte.
    select coalesce(
      jsonb_agg(l || jsonb_build_object('unit_price_cents', (l ->> 'unit_price_cents')::int + v_rate.price_cents) order by n),
      '[]'::jsonb
    )
    into v_lines
    from jsonb_array_elements(v_lines) with ordinality as e(l, n);
    v_included := v_rate.price_cents::bigint * v_units;
    v_subtotal := v_subtotal + v_included;
    v_shipping := 0;
  end if;

  if v_subtotal > 100000000 then
    perform public._fail('cart_too_large');
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
    'shipping_cents', v_shipping,
    'shipping_included_cents', v_included,
    'shipping_estimate', v_rate.delivery_estimate,
    'coupon_id', case when v_code <> '' then v_coupon.id end,
    'coupon_code', case when v_code <> '' then v_coupon.code end,
    'discount_cents', v_discount,
    'total_cents', v_subtotal - v_discount + v_shipping
  );
end;
$$;
