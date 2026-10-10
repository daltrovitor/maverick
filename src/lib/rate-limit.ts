// Hello World
import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";
import { getServiceDb } from "@/lib/supabase/server";

/** IP do cliente atrás da Vercel/CDN. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "0.0.0.0";
}

/** Hash com sal: permite limitar e investigar abusos sem guardar o IP (LGPD). */
export async function hashedClientIp(): Promise<string> {
  const salt = serverEnv().IP_HASH_SALT ?? "maverick-dev-salt-change-me";
  return createHash("sha256").update(`${salt}:${await clientIp()}`).digest("hex");
}

/**
 * Janela fixa no Postgres (funciona em ambiente serverless, sem estado em memória).
 * Retorna true se a requisição pode seguir.
 */
export async function allowRequest(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const key = `${bucket}:${await hashedClientIp()}`;
  const { data, error } = await getServiceDb().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  // Falha do limitador não deve derrubar a venda: registra e deixa passar.
  if (error) {
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data === true;
}
