-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 08 · STRIPE SEM WEBHOOK
-- A loja confirma os pagamentos consultando o Stripe (página do pedido, painel e rotina
-- diária). Um pedido com cobrança no Stripe só expira depois dessa conferência: assim um
-- Pix pago cujo cliente fechou a página nunca é expirado por engano.
-- =====================================================================================

-- Expiração automática: apenas pedidos SEM cobrança aberta no Stripe (Pix manual e
-- pedidos antigos do Checkout). Os demais passam por public.expire_order, chamada pelo
-- app depois de conferir e cancelar a cobrança no Stripe.
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
    where o.status = 'awaiting_payment'
      and o.expires_at < now()
      and o.stripe_payment_intent_id is null
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

-- Expira um pedido vencido cuja cobrança no Stripe já foi conferida e cancelada pelo app.
create or replace function public.expire_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'awaiting_payment' or o.expires_at is null or o.expires_at >= now() then
    return false;
  end if;
  perform public._release_order_stock(o.id);
  update public.orders
  set status = 'expired', payment_status = 'expired', canceled_at = now()
  where id = o.id;
  insert into public.order_events (order_id, type, from_status, to_status, actor_kind, message)
  values (o.id, 'expired', 'awaiting_payment', 'expired', 'system',
          'Prazo encerrado sem pagamento; cobrança cancelada no Stripe e estoque devolvido.');
  return true;
end;
$$;

revoke execute on function public.expire_order(uuid) from public, anon, authenticated;
grant execute on function public.expire_order(uuid) to service_role;
