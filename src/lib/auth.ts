// Hello World
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { ProfileRow } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionDb, type Db } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  profile: ProfileRow | null;
}

/** Usuário autenticado (JWT verificado pelo Supabase) ou null. Memoizado por requisição. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured) return null;
  const db = await getSessionDb();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email ?? "", profile: profile ?? null };
});

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * Exige administrador. Em páginas redireciona; em Server Actions lança ForbiddenError
 * (passe `mode: "action"`). O banco confere o papel de novo em cada função administrativa.
 */
export async function requireAdmin(mode: "page" | "action" = "page"): Promise<{ user: SessionUser; db: Db }> {
  const user = await getCurrentUser();
  if (!user || user.profile?.role !== "admin") {
    if (mode === "action") throw new ForbiddenError();
    redirect(user ? "/conta?acesso=negado" : "/conta?proximo=/admin");
  }
  return { user, db: await getSessionDb() };
}
