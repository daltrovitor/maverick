-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 05 · SEGURANÇA (RLS + privilégios explícitos)
-- Princípio: o público só LÊ o catálogo ativo; clientes leem os próprios pedidos;
-- administradores gerenciam tudo; operações sensíveis passam pelas funções.
-- =====================================================================================

-- RLS em todas as tabelas
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.store_settings enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.affiliate_applications enable row level security;
alter table public.affiliate_attempts enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.rate_limits enable row level security;

-- ------------------------------------------------------------------ perfis
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ------------------------------------------------------------------ catálogo
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy categories_admin_write on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_public_read on public.products
  for select to anon, authenticated
  using (status = 'active' or public.is_admin());
create policy products_admin_write on public.products
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy variants_public_read on public.product_variants
  for select to anon, authenticated
  using (
    public.is_admin()
    or (is_active and exists (
      select 1 from public.products p where p.id = product_id and p.status = 'active'
    ))
  );
create policy variants_admin_write on public.product_variants
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy images_public_read on public.product_images
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
  );
create policy images_admin_write on public.product_images
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ configurações e frete
create policy settings_public_read on public.store_settings
  for select to anon, authenticated
  using (true);
create policy settings_admin_update on public.store_settings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy shipping_public_read on public.shipping_rates
  for select to anon, authenticated
  using (is_active or public.is_admin());
create policy shipping_admin_write on public.shipping_rates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ afiliados e cupons (somente admin)
create policy affiliates_admin_read on public.affiliate_applications
  for select to authenticated
  using (public.is_admin());
create policy affiliate_attempts_admin_read on public.affiliate_attempts
  for select to authenticated
  using (public.is_admin());

create policy coupons_admin_all on public.coupons
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy coupon_redemptions_admin_read on public.coupon_redemptions
  for select to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------------ pedidos
create policy orders_owner_or_admin_read on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy order_items_owner_or_admin_read on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())
  ));

create policy order_events_owner_or_admin_read on public.order_events
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())
  ));

-- stripe_events e rate_limits: sem políticas (apenas service role, que ignora RLS).

-- =====================================================================================
-- PRIVILÉGIOS DE TABELA (não dependemos dos padrões do projeto)
-- =====================================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.categories, public.products, public.product_variants, public.product_images,
  public.store_settings, public.shipping_rates
  to anon, authenticated;

grant select on public.profiles, public.orders, public.order_items, public.order_events,
  public.affiliate_applications, public.affiliate_attempts, public.coupons, public.coupon_redemptions
  to authenticated;

-- Cliente só altera nome e telefone; o papel nunca é editável pelo próprio usuário.
grant update (full_name, phone) on public.profiles to authenticated;

-- Escrita administrativa direta (RLS restringe a admins).
grant insert, update, delete on public.categories, public.products, public.product_variants,
  public.product_images, public.shipping_rates, public.coupons
  to authenticated;
grant update (
  store_name, contact_email, whatsapp, instagram_url, pix_key, pix_key_type, pix_holder_name,
  pix_city, pix_expiration_hours, card_enabled, announcement, shipping_policy, exchange_policy, updated_by
) on public.store_settings to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- =====================================================================================
-- PRIVILÉGIOS DE FUNÇÃO
-- =====================================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

-- Utilitários usados por políticas/constraints
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_valid_cpf(text) to anon, authenticated, service_role;
grant execute on function public.is_valid_uf(text) to anon, authenticated, service_role;
grant execute on function public.random_token() to anon, authenticated, service_role;

-- Leituras públicas por link secreto
grant execute on function public.get_order_by_token(text) to anon, authenticated, service_role;
grant execute on function public.get_affiliate_status(text) to anon, authenticated, service_role;

-- Operações do servidor (validação + rate limit acontecem antes, no app)
grant execute on function public.quote_order(jsonb) to service_role;
grant execute on function public.create_order(jsonb, uuid) to service_role;
grant execute on function public.expire_stale_orders() to service_role;
grant execute on function public.attach_stripe_session(uuid, text) to service_role;
grant execute on function public.process_stripe_event(text, text, uuid, text, text, text) to service_role;
grant execute on function public.submit_affiliate_application(jsonb, text) to service_role;
grant execute on function public.affiliate_respond(text, text) to service_role;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- Ações administrativas (cada função confere is_admin() internamente)
grant execute on function public.admin_confirm_pix(uuid, text) to authenticated;
grant execute on function public.admin_reject_pix(uuid, text) to authenticated;
grant execute on function public.admin_set_order_status(uuid, text, text, text) to authenticated;
grant execute on function public.admin_approve_affiliate(uuid, int, text) to authenticated;
grant execute on function public.admin_reject_affiliate(uuid, text) to authenticated;
grant execute on function public.admin_request_affiliate_info(uuid, text) to authenticated;
grant execute on function public.admin_save_product(jsonb) to authenticated;
grant execute on function public.admin_delete_product(uuid) to authenticated;
grant execute on function public.admin_dashboard(int) to authenticated;
