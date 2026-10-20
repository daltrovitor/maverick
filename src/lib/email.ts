// Hello World
import "server-only";
import { serverEnv } from "@/lib/env";

/** Escapa texto do cliente antes de entrar no HTML do e-mail. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface StoreEmail {
  subject: string;
  /** Linhas [rótulo, valor] em texto puro; o HTML é montado (e escapado) aqui. */
  rows: [string, string][];
  intro?: string;
  link?: { href: string; label: string };
  replyTo?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv().RESEND_API_KEY);
}

/**
 * Aviso para a equipe (NOTIFY_EMAIL_TO) pela API do Resend. Nunca derruba o fluxo do
 * cliente: sem chave ou com falha, registra no log e devolve false.
 */
export async function notifyStore(email: StoreEmail): Promise<boolean> {
  const env = serverEnv();
  if (!env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY ausente; aviso não enviado:", email.subject);
    return false;
  }

  const rowsHtml = email.rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b5b49;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#26170a">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#26170a">` +
    (email.intro ? `<p>${escapeHtml(email.intro)}</p>` : "") +
    `<table style="border-collapse:collapse">${rowsHtml}</table>` +
    (email.link
      ? `<p style="margin-top:20px"><a href="${escapeHtml(email.link.href)}" style="color:#86611d">${escapeHtml(email.link.label)}</a></p>`
      : "") +
    `</div>`;
  const text = [email.intro, ...email.rows.map(([l, v]) => `${l}: ${v}`), email.link ? `${email.link.label}: ${email.link.href}` : null]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [env.NOTIFY_EMAIL_TO],
        subject: email.subject,
        html,
        text,
        reply_to: email.replyTo,
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[email] Resend respondeu", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] falha ao enviar", err);
    return false;
  }
}
