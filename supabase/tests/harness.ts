// Hello World
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Banco Postgres real (WASM) com as migrations do projeto aplicadas sobre um shim mínimo
 * do Supabase: schema `auth` (users + uid()), papéis anon/authenticated/service_role e
 * tabelas de storage. Permite testar regras de negócio e RLS sem Docker.
 */
const SUPABASE_SHIM = `
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text
  );
  alter table storage.objects enable row level security;
`;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export type DbRole = "postgres" | "anon" | "authenticated" | "service_role";

export interface TestDb {
  readonly db: PGlite;
  /** Executa `fn` com o papel e o usuário (auth.uid()) informados. */
  as<T>(role: DbRole, userId: string | null, fn: () => Promise<T>): Promise<T>;
  /** Atalho: SELECT de uma função retornando a coluna `r`. */
  call<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
  createUser(email: string, role?: "customer" | "admin"): Promise<string>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  const as: TestDb["as"] = async (role, userId, fn) => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await db.exec(role === "postgres" ? "reset role" : `set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
    }
  };

  const call: TestDb["call"] = async <T,>(sql: string, params: unknown[] = []) => {
    const res = await db.query<{ r: T }>(sql, params);
    const row = res.rows[0];
    if (!row) throw new Error("sem resultado");
    return row.r;
  };

  const createUser: TestDb["createUser"] = async (email, role = "customer") => {
    const id = crypto.randomUUID();
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    if (role === "admin") {
      await db.query("update public.profiles set role = 'admin' where id = $1", [id]);
    }
    return id;
  };

  return { db, as, call, createUser, close: () => db.close() };
}
