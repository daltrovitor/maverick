// Hello World
"use server";

import { after } from "next/server";
import { z } from "zod";
import { formatBRL, formatBrPhone } from "@/lib/br";
import { formatBps } from "@/lib/custom-pricing";
import { notifyStore } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { errorCode, errorMessage } from "@/lib/errors";
import { allowRequest, hashedClientIp } from "@/lib/rate-limit";
import { CUSTOM_DESIGNS_BUCKET } from "@/lib/storage";
import { getServiceDb, NotConfiguredError } from "@/lib/supabase/server";
import { CAP_MODELS, CAP_TECHNIQUES, customRequestSchema, designUploadSchema, firstIssue } from "@/lib/validation";

type Fail = { ok: false; message: string; field?: string };

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function fail(code: string): Fail {
  return { ok: false, message: errorMessage(code) };
}

async function customEnabled(): Promise<boolean> {
  const { data } = await getServiceDb().from("store_settings").select("custom_enabled").maybeSingle();
  return data?.custom_enabled !== false;
}

export type StartUploadResult = { ok: true; path: string; token: string } | Fail;

/**
 * Autoriza o envio de UMA arte: devolve um token de upload assinado para um caminho novo
 * no bucket privado. O arquivo vai do navegador direto ao Storage (sem passar pelo
 * servidor da Vercel), e o bucket recusa tipo/tamanho fora do permitido.
 */
export async function startDesignUpload(input: unknown): Promise<StartUploadResult> {
  const parsed = designUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error), field: "design" };
  try {
    if (!(await allowRequest("custom-upload", 12, 3600))) return fail("rate_limited");
    if (!(await customEnabled())) return fail("custom_unavailable");
    const path = `requests/${crypto.randomUUID()}/arte.${EXTENSION[parsed.data.mime]}`;
    const { data, error } = await getServiceDb().storage.from(CUSTOM_DESIGNS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[personalizado] signed upload", error?.message);
      return fail("unknown");
    }
    return { ok: true, path: data.path, token: data.token };
  } catch (err) {
    if (err instanceof NotConfiguredError) return fail("not_configured");
    console.error("[personalizado] startDesignUpload", err);
    return fail("unknown");
  }
}

const submitResponse = z.object({
  id: z.uuid(),
  number: z.number(),
  unit_price_cents: z.number().nullable(),
  discount_bps: z.number(),
  estimated_total_cents: z.number().nullable(),
});

export type SubmitCustomResult =
  | { ok: true; number: number; estimatedTotalCents: number | null; discountBps: number }
  | Fail;

/** Registra o pedido de boné personalizado (preço da calculadora recalculado no banco) e avisa a equipe. */
export async function submitCustomRequest(input: unknown): Promise<SubmitCustomResult> {
  const parsed = customRequestSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Dados inválidos", field: issue?.path.join(".") };
  }
  const r = parsed.data;

  try {
    if (!(await allowRequest("custom", 6, 3600))) return fail("rate_limited");
    const db = getServiceDb();

    // A arte precisa existir no caminho autorizado, com o tipo e o tamanho declarados.
    const [dir, name] = [r.design.path.slice(0, r.design.path.lastIndexOf("/")), r.design.path.split("/").pop() ?? ""];
    const { data: listed, error: listError } = await db.storage.from(CUSTOM_DESIGNS_BUCKET).list(dir, { limit: 5 });
    const object = listed?.find((o) => o.name === name);
    if (listError || !object) {
      return { ok: false, message: "Não encontramos a arte enviada. Selecione o arquivo de novo.", field: "design" };
    }
    const metadata = z.object({ size: z.number(), mimetype: z.string() }).safeParse(object.metadata);
    if (metadata.success && (metadata.data.mimetype !== r.design.mime || metadata.data.size !== r.design.size)) {
      return { ok: false, message: "O arquivo enviado não confere. Selecione a arte de novo.", field: "design" };
    }

    const { data, error } = await db.rpc("submit_custom_request", {
      p: {
        name: r.name,
        email: r.email,
        phone: r.phone,
        quantity: r.quantity,
        cap_model: r.capModel,
        cap_color: r.capColor,
        technique: r.technique,
        notes: r.notes,
        design_path: r.design.path,
        design_mime: r.design.mime,
        design_size: metadata.success ? metadata.data.size : r.design.size,
        privacy_consent: r.privacyConsent,
      },
      p_ip_hash: await hashedClientIp(),
    });
    if (error) {
      const code = errorCode(error);
      if (code === "unknown") console.error("[personalizado] submit", error);
      return { ok: false, message: errorMessage(code), field: code === "custom_quantity_range" ? "quantity" : undefined };
    }
    const saved = submitResponse.parse(data);

    after(async () => {
      const { data: signed } = await getServiceDb()
        .storage.from(CUSTOM_DESIGNS_BUCKET)
        .createSignedUrl(r.design.path, 60 * 60 * 24 * 7);
      await notifyStore({
        subject: `Boné personalizado · pedido nº ${saved.number} · ${r.quantity} un.`,
        intro: "Novo pedido de boné personalizado pelo site.",
        rows: [
          ["Pedido", `nº ${saved.number}`],
          ["Cliente", r.name],
          ["E-mail", r.email],
          ["WhatsApp", formatBrPhone(r.phone)],
          ["Quantidade", `${r.quantity} unidades`],
          ["Modelo", CAP_MODELS.find((m) => m.value === r.capModel)?.label ?? r.capModel],
          ["Cor", r.capColor ?? "—"],
          ["Técnica", CAP_TECHNIQUES.find((t) => t.value === r.technique)?.label ?? r.technique],
          [
            "Estimativa",
            saved.estimated_total_cents === null
              ? "Sem preço base no painel (sob consulta)"
              : `${formatBRL(saved.estimated_total_cents)} (desconto de ${formatBps(saved.discount_bps)})`,
          ],
          ["Observações", r.notes ?? "—"],
          ["Arte", signed?.signedUrl ? `${signed.signedUrl} (link válido por 7 dias)` : "Disponível no painel"],
        ],
        link: { href: `${siteUrl}/admin/personalizados/${saved.id}`, label: "Abrir no painel" },
        replyTo: r.email,
      });
    });

    return {
      ok: true,
      number: saved.number,
      estimatedTotalCents: saved.estimated_total_cents,
      discountBps: saved.discount_bps,
    };
  } catch (err) {
    if (err instanceof NotConfiguredError) return fail("not_configured");
    console.error("[personalizado] submitCustomRequest", err);
    return fail("unknown");
  }
}
