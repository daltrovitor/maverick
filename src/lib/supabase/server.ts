// Hello World
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, serverEnv } from "@/lib/env";

export type Db = SupabaseClient<Database>;

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} não configurado`);
    this.name = "NotConfiguredError";
  }
}

function requirePublicKeys() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new NotConfiguredError("Supabase");
  return { url, anon };
}

/**
 * Cliente da sessão atual (cookies). Respeita RLS: o que o usuário vê é o que o banco permite.
 * Use em Server Components, Server Actions e Route Handlers.
 */
export async function getSessionDb(): Promise<Db> {
  const { url, anon } = requirePublicKeys();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy já renovou a sessão.
        }
      },
    },
  });
}

/**
 * Cliente público sem cookies (catálogo). Permite páginas estáticas/ISR.
 * Retorna null quando o Supabase ainda não foi configurado.
 */
export function getPublicDb(): Db | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service role: ignora RLS. Exclusivo para operações do servidor que já validaram a entrada
 * (checkout, webhook do Stripe, candidatura de afiliado, expiração de pedidos).
 */
export function getServiceDb(): Db {
  const { url } = requirePublicKeys();
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new NotConfiguredError("SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
