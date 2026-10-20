// Hello World
import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import type { DimonaOrderPayload } from "@/lib/dimona-payload";

/**
 * Cliente da API da Dimona (https://api.camisadimona.com.br/). Autenticação pelo
 * cabeçalho `api-key`; domínio da API: admin.camisadimona.com.br.
 * A API não lista produtos: cada produto da loja é vinculado no painel ao SKU Dimona.
 */
export class DimonaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DimonaError";
  }
}

export function isDimonaConfigured(): boolean {
  return Boolean(serverEnv().DIMONA_API_KEY);
}

async function dimonaFetch(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
  const env = serverEnv();
  if (!env.DIMONA_API_KEY) throw new DimonaError("DIMONA_API_KEY não configurada", 0);
  const res = await fetch(`${env.DIMONA_API_BASE_URL.replace(/\/$/, "")}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "api-key": env.DIMONA_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    // A Dimona às vezes responde texto puro (ex.: "O pedido 1234 já existe").
  }
  if (!res.ok) {
    const message = typeof body === "string" ? body : Array.isArray(body) ? body.join(" ") : JSON.stringify(body);
    throw new DimonaError(message.slice(0, 500) || `HTTP ${res.status}`, res.status);
  }
  return body;
}

export type CreateDimonaResult = { kind: "created"; dimonaId: string } | { kind: "duplicate" };

/** POST /api/v3/order (artes nomeadas por lado). 422 "já existe" = pedido já repassado. */
export async function createDimonaOrder(payload: DimonaOrderPayload): Promise<CreateDimonaResult> {
  try {
    const body = await dimonaFetch("/api/v3/order", { method: "POST", body: payload });
    const parsed = z.object({ order: z.union([z.string(), z.number()]) }).safeParse(body);
    if (!parsed.success) throw new DimonaError(`Resposta inesperada: ${JSON.stringify(body).slice(0, 200)}`, 200);
    return { kind: "created", dimonaId: String(parsed.data.order) };
  } catch (err) {
    if (err instanceof DimonaError && err.status === 422 && /j[aá] existe/i.test(err.message)) {
      return { kind: "duplicate" };
    }
    throw err;
  }
}

const orderInfoSchema = z.object({
  dimona_id: z.union([z.string(), z.number()]).transform(String),
  seller_id: z.union([z.string(), z.number()]).transform(String).nullish(),
  status: z.string().nullish(),
  status_id: z.coerce.number().int().nullish(),
  tracking_url: z.string().nullish(),
  tracking_code: z.string().nullish(),
});

export type DimonaOrderInfo = z.infer<typeof orderInfoSchema>;

/** GET /api/v2/order/{id}: status, frete e link de rastreio. */
export async function getDimonaOrder(dimonaId: string): Promise<DimonaOrderInfo> {
  const body = await dimonaFetch(`/api/v2/order/${encodeURIComponent(dimonaId)}`);
  return orderInfoSchema.parse(body);
}

/** Procura, na lista de pedidos da conta, o pedido com o nosso identificador (seller_id). */
export async function findDimonaOrderBySellerId(sellerId: string): Promise<DimonaOrderInfo | null> {
  const body = await dimonaFetch("/api/v2/orders");
  const list = Array.isArray(body) ? body : z.object({ data: z.array(z.unknown()) }).safeParse(body).data?.data ?? [];
  for (const entry of list) {
    const info = orderInfoSchema.safeParse(entry);
    if (info.success && info.data.seller_id === sellerId) return info.data;
  }
  return null;
}

/** Corpo do webhook da Dimona (POST a cada mudança de status). */
export const dimonaWebhookSchema = z.object({
  api_key: z.string().min(1),
  dimona_id: z.union([z.string(), z.number()]).transform(String),
  status_id: z.coerce.number().int().nullish(),
  name: z.string().max(200).nullish(),
  seller_id: z.union([z.string(), z.number()]).transform(String).nullish(),
  tracking_url: z.string().max(500).nullish(),
});
