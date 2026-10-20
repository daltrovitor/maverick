// Hello World
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { reconcileStripePayments } from "@/lib/payments";
import { getServiceDb } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Confere no Stripe os pedidos com cobrança aberta (pagos/vencidos), expira os não pagos no
 * prazo e devolve o estoque reservado.
 * Chamado pelo Vercel Cron (vercel.json) com `Authorization: Bearer $CRON_SECRET`.
 * O painel também executa a mesma rotina ao listar pedidos.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const stripe = await reconcileStripePayments(200).catch((err: unknown) => {
    console.error("[cron] conciliação Stripe", err);
    return null;
  });
  const { data, error } = await getServiceDb().rpc("expire_stale_orders");
  if (error) {
    console.error("[cron] expire_stale_orders", error.message);
    return NextResponse.json({ error: "falha" }, { status: 500 });
  }
  return NextResponse.json({ expired: data, stripe });
}
