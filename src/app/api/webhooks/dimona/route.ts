// Hello World
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dimonaWebhookSchema } from "@/lib/dimona";
import { serverEnv } from "@/lib/env";
import { getServiceDb } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameSecret(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook da Dimona: um POST a cada mudança de status do pedido (produção, faturado,
 * enviado...). A Dimona assina com a própria api_key da conta no corpo, conferida aqui.
 */
export async function POST(request: Request) {
  const key = serverEnv().DIMONA_API_KEY;
  if (!key) return NextResponse.json({ error: "webhook não configurado" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }
  const parsed = dimonaWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  if (!sameSecret(key, parsed.data.api_key)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const { data, error } = await getServiceDb().rpc("dimona_apply_status", {
    p_dimona_id: parsed.data.dimona_id,
    p_seller_id: parsed.data.seller_id ?? null,
    p_status_id: parsed.data.status_id ?? null,
    p_status_name: parsed.data.name ?? null,
    p_tracking_url: parsed.data.tracking_url ?? null,
  });
  if (error) {
    console.error("[dimona-webhook]", parsed.data.dimona_id, error.message);
    return NextResponse.json({ error: "falha ao registrar" }, { status: 500 });
  }
  return NextResponse.json({ received: true, result: data });
}
