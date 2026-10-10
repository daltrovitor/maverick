-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 02 · CATÁLOGO
-- Categorias simples (sem "categorias principais"), produtos, variantes e imagens.
-- Valores monetários sempre em centavos (inteiros). O catálogo nasce vazio.
-- =====================================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  -- Especificações exibidas na página do produto: [{"label": "Material", "value": "100% algodão"}]
  specs jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  category_id uuid references public.categories (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  -- Produtos em destaque aparecem na fileira da transição cinematográfica da página inicial.
  is_featured boolean not null default false,
  position int not null default 0,
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_position_idx on public.products (status, position, created_at desc);
create index products_category_idx on public.products (category_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text unique check (sku is null or char_length(sku) between 1 and 60),
  color text check (color is null or char_length(color) between 1 and 40),
  size text check (size is null or char_length(size) between 1 and 20),
  price_cents int not null check (price_cents > 0 and price_cents <= 10000000),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents > price_cents),
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_option_unique unique nulls not distinct (product_id, color, size)
);

create index product_variants_product_idx on public.product_variants (product_id, position);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Caminho dentro do bucket "product-images"; a URL pública é derivada no app.
  storage_path text not null check (storage_path ~ '^products/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  alt text not null default '' check (char_length(alt) <= 160),
  -- Opcional: associa a foto a uma cor de variante.
  color text check (color is null or char_length(color) between 1 and 40),
  position int not null default 0,
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);
