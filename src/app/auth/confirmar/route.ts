// Hello World
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSessionDb } from "@/lib/supabase/server";

const OTP_TYPES: ReadonlySet<string> = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/conta";
}

/** Retorno dos e-mails do Supabase Auth (confirmação de cadastro e recuperação de senha). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("proximo"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const db = await getSessionDb();

  let ok = false;
  if (code) {
    ok = !(await db.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ok = !(await db.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })).error;
  }

  const target = new URL(ok ? next : "/conta?link=expirado", url.origin);
  return NextResponse.redirect(target);
}
