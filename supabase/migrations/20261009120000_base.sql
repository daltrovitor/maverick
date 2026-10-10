-- Hello World
-- =====================================================================================
-- MAVERICK CAPSHOP · 01 · BASE
-- Utilitários, perfis de usuário e a função de autorização administrativa.
-- Banco novo: nenhuma tabela, dado ou papel herdado da Ashen's Store.
-- =====================================================================================

-- Token aleatório de 64 caracteres hex (244 bits de entropia) sem depender de extensões.
create or replace function public.random_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

-- Mantém updated_at coerente em toda atualização.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Validação de CPF com dígitos verificadores (rejeita sequências repetidas).
create or replace function public.is_valid_cpf(c text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d int[];
  s int;
  r int;
  i int;
begin
  if c is null or c !~ '^[0-9]{11}$' or c ~ '^([0-9])\1{10}$' then
    return false;
  end if;
  d := array(select substr(c, g, 1)::int from generate_series(1, 11) as g);
  s := 0;
  for i in 1..9 loop s := s + d[i] * (11 - i); end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> d[10] then return false; end if;
  s := 0;
  for i in 1..10 loop s := s + d[i] * (12 - i); end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  return r = d[11];
end;
$$;

-- Siglas oficiais das 27 unidades federativas.
create or replace function public.is_valid_uf(uf text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select uf in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  );
$$;

-- =====================================================================================
-- PERFIS
-- O papel só pode ser alterado por SQL/service role (sem privilégio de UPDATE na coluna).
-- =====================================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^55[0-9]{10,11}$'),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Todo novo usuário nasce cliente. Promoção a admin: scripts/promote-admin.mjs ou SQL manual.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;
