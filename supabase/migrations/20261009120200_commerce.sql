-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 03 · COMÉRCIO
-- Configurações, frete por UF, afiliados, cupons, pedidos, pagamentos e auditoria.
-- =====================================================================================

-- Linha única de configurações da loja (editável no painel).
create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Maverick Capshop' check (char_length(store_name) between 1 and 80),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  instagram_url text check (instagram_url is null or instagram_url ~* '^https://'),
  -- Pix (confirmação manual). Sem chave configurada, o Pix fica indisponível no checkout.
  pix_key text check (pix_key is null or char_length(pix_key) between 1 and 77),
  pix_key_type text check (pix_key_type is null or pix_key_type in ('cpf', 'cnpj', 'email', 'phone', 'random')),
  pix_holder_name text check (pix_holder_name is null or pix_holder_name ~ '^[A-Z0-9 ]{1,25}$'),
  pix_city text check (pix_city is null or pix_city ~ '^[A-Z ]{1,15}$'),
  pix_expiration_hours int not null default 24 check (pix_expiration_hours between 1 and 168),
  card_enabled boolean not null default true,
  announcement text check (announcement is null or char_length(announcement) <= 140),
  shipping_policy text check (shipping_policy is null or char_length(shipping_policy) <= 8000),
  exchange_policy text check (exchange_policy is null or char_length(exchange_policy) <= 8000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (id) values (true);

-- Frete por unidade federativa. Sem regra ativa para a UF, o pedido não pode ser concluído.
create table public.shipping_rates (
  uf char(2) primary key check (public.is_valid_uf(uf)),
  price_cents int not null check (price_cents >= 0 and price_cents <= 1000000),
  delivery_estimate text check (delivery_estimate is null or char_length(delivery_estimate) <= 60),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger shipping_rates_set_updated_at
  before update on public.shipping_rates
  for each row execute function public.set_updated_at();

-- =====================================================================================
-- AFILIADOS
-- A combinação CPF + telefone é única para sempre (inclusive após rejeição).
-- =====================================================================================
create table public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'info_requested', 'approved', 'rejected')),
  full_name text not null check (char_length(full_name) between 5 and 120),
  cpf char(11) not null check (public.is_valid_cpf(cpf)),
  phone text not null check (phone ~ '^55[0-9]{10,11}$'),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 160),
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'x', 'facebook', 'kwai', 'outra')),
  profile_url text not null check (profile_url ~* '^https://[^\s]+$' and char_length(profile_url) between 12 and 300),
  followers_declared int not null check (followers_declared >= 1000 and followers_declared <= 1000000000),
  followers_verified int check (followers_verified is null or followers_verified >= 0),
  audience text not null check (char_length(audience) between 20 and 1000),
  sales_forecast_monthly int not null check (sales_forecast_monthly between 1 and 100000),
  sales_forecast_basis text not null check (char_length(sales_forecast_basis) between 20 and 1000),
  strategy text not null check (char_length(strategy) between 20 and 2000),
  channels text[] not null check (cardinality(channels) between 1 and 8),
  truth_confirmed boolean not null check (truth_confirmed),
  privacy_consent_at timestamptz not null,
  status_token text not null unique default public.random_token(),
  info_request_message text check (info_request_message is null or char_length(info_request_message) <= 1000),
  applicant_response text check (applicant_response is null or char_length(applicant_response) <= 2000),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 2000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  ip_hash text check (ip_hash is null or char_length(ip_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_cpf_phone_unique unique (cpf, phone)
);

create index affiliate_applications_status_idx on public.affiliate_applications (status, created_at desc);
create index affiliate_applications_cpf_idx on public.affiliate_applications (cpf);
create index affiliate_applications_phone_idx on public.affiliate_applications (phone);

create trigger affiliate_applications_set_updated_at
  before update on public.affiliate_applications
  for each row execute function public.set_updated_at();

-- Tentativas bloqueadas (mesma combinação CPF + telefone) para análise administrativa.
create table public.affiliate_attempts (
  id bigint generated always as identity primary key,
  cpf char(11) not null,
  phone text not null,
  reason text not null check (reason in ('duplicate_pair')),
  existing_application_id uuid references public.affiliate_applications (id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index affiliate_attempts_created_idx on public.affiliate_attempts (created_at desc);

-- =====================================================================================
-- CUPONS
-- =====================================================================================
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9-]{3,32}$'),
  description text check (description is null or char_length(description) <= 200),
  kind text not null check (kind in ('percent', 'fixed')),
  -- percent: 1..100 · fixed: centavos
  value int not null check (value > 0),
  min_subtotal_cents int not null default 0 check (min_subtotal_cents >= 0),
  max_uses int check (max_uses is null or max_uses > 0),
  max_uses_per_customer int not null default 1 check (max_uses_per_customer > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  uses_count int not null default 0 check (uses_count >= 0),
  affiliate_application_id uuid references public.affiliate_applications (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 100),
  constraint coupons_window check (expires_at is null or expires_at > starts_at)
);

create unique index coupons_code_unique on public.coupons (code);
create index coupons_affiliate_idx on public.coupons (affiliate_application_id);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- =====================================================================================
-- PEDIDOS
-- =====================================================================================
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.order_number_seq'),
  -- Link secreto de acompanhamento (/pedido/<token>), nunca sequencial.
  public_token text not null unique default public.random_token(),
  -- Evita pedidos duplicados por clique duplo/reenvio.
  idempotency_key uuid not null unique,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'preparing', 'shipped', 'delivered', 'canceled', 'expired')),
  payment_method text not null check (payment_method in ('pix', 'card')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'rejected', 'failed', 'expired', 'canceled', 'refunded')),
  customer_name text not null check (char_length(customer_name) between 3 and 120),
  customer_email text not null check (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(customer_email) <= 160),
  customer_phone text not null check (customer_phone ~ '^55[0-9]{10,11}$'),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  shipping_uf char(2) not null check (public.is_valid_uf(shipping_uf)),
  -- Valor do frete congelado no momento da compra (mudanças futuras não afetam o pedido).
  shipping_cents int not null check (shipping_cents >= 0),
  shipping_estimate text,
  cep_verified boolean not null default false,
  subtotal_cents int not null check (subtotal_cents > 0),
  discount_cents int not null default 0 check (discount_cents >= 0 and discount_cents <= subtotal_cents),
  total_cents int not null,
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  tracking_code text check (tracking_code is null or char_length(tracking_code) <= 60),
  customer_notes text check (customer_notes is null or char_length(customer_notes) <= 500),
  expires_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_consistent check (total_cents = subtotal_cents - discount_cents + shipping_cents)
);

create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_email_idx on public.orders (lower(customer_email));
create index orders_awaiting_expiry_idx on public.orders (expires_at) where status = 'awaiting_payment';
create index orders_coupon_idx on public.orders (coupon_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- Fotografia do item no momento da compra.
  product_name text not null,
  variant_label text,
  sku text,
  image_path text,
  unit_price_cents int not null check (unit_price_cents > 0),
  quantity int not null check (quantity between 1 and 20),
  total_cents int generated always as (unit_price_cents * quantity) stored
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

-- Trilha de auditoria: quem mudou o quê e quando.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null check (type in (
    'created', 'pix_confirmed', 'pix_rejected', 'card_paid', 'card_failed',
    'status_changed', 'expired', 'stock_conflict', 'note'
  )),
  from_status text,
  to_status text,
  actor_kind text not null check (actor_kind in ('system', 'admin', 'customer', 'stripe')),
  actor_id uuid references auth.users (id) on delete set null,
  message text check (message is null or char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_key text not null,
  discount_cents int not null check (discount_cents >= 0),
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index coupon_redemptions_customer_idx on public.coupon_redemptions (coupon_id, customer_key) where released_at is null;

-- Idempotência dos webhooks do Stripe: cada evento é aplicado uma única vez.
create table public.stripe_events (
  id text primary key,
  type text not null,
  order_id uuid references public.orders (id) on delete set null,
  outcome text not null,
  received_at timestamptz not null default now()
);

-- Limite de requisições por chave (IP com hash) e janela de tempo.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
