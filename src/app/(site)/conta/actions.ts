// Hello World
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { errorMessage } from "@/lib/errors";
import { allowRequest } from "@/lib/rate-limit";
import { getSessionDb, NotConfiguredError } from "@/lib/supabase/server";
import { emailSchema, firstIssue, phoneSchema } from "@/lib/validation";

// Arquivos "use server" só exportam funções assíncronas; o estado inicial vive no cliente.
export interface FormResult {
  ok: boolean;
  message: string;
}

const passwordSchema = z.string().min(8, "A senha precisa de ao menos 8 caracteres").max(72);

/** Aceita apenas caminhos internos como destino pós-login (evita open redirect). */
function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : "/conta";
}

async function guard(bucket: string, limit: number): Promise<FormResult | null> {
  try {
    if (!(await allowRequest(bucket, limit, 600))) return { ok: false, message: errorMessage("rate_limited") };
    return null;
  } catch (err) {
    if (err instanceof NotConfiguredError) return { ok: false, message: errorMessage("not_configured") };
    throw err;
  }
}

export async function signIn(_: FormResult, form: FormData): Promise<FormResult> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Informe a senha") })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const blocked = await guard("login", 10);
  if (blocked) return blocked;

  const db = await getSessionDb();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      message: error.code === "email_not_confirmed" ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.",
    };
  }
  redirect(safeNext(form.get("proximo")));
}

export async function signUp(_: FormResult, form: FormData): Promise<FormResult> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(3, "Informe seu nome").max(120),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const blocked = await guard("signup", 5);
  if (blocked) return blocked;

  const db = await getSessionDb();
  const { error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/confirmar?proximo=/conta`,
    },
  });
  if (error) {
    return { ok: false, message: error.code === "weak_password" ? "Escolha uma senha mais forte." : "Não foi possível criar a conta agora." };
  }
  // Mesma resposta para e-mail novo ou já cadastrado (não revela quem tem conta).
  return { ok: true, message: "Enviamos um link de confirmação para o seu e-mail." };
}

export async function requestPasswordReset(_: FormResult, form: FormData): Promise<FormResult> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const blocked = await guard("reset", 5);
  if (blocked) return blocked;
  const db = await getSessionDb();
  await db.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/confirmar?proximo=/conta/nova-senha`,
  });
  return { ok: true, message: "Se houver uma conta com este e-mail, você receberá o link para criar uma nova senha." };
}

export async function updatePassword(_: FormResult, form: FormData): Promise<FormResult> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "As senhas não conferem", path: ["confirm"] })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "O link expirou. Peça um novo link de recuperação." };
  const db = await getSessionDb();
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "Não foi possível alterar a senha. Tente outra." };
  return { ok: true, message: "Senha alterada com sucesso." };
}

export async function updateProfile(_: FormResult, form: FormData): Promise<FormResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre novamente para continuar." };
  const parsed = z
    .object({
      fullName: z.string().trim().min(3, "Informe seu nome").max(120),
      phone: z.union([z.literal(""), phoneSchema]),
    })
    .safeParse({ fullName: form.get("fullName"), phone: form.get("phone") ?? "" });
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const db = await getSessionDb();
  const { error } = await db
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return { ok: false, message: "Não foi possível salvar agora." };
  revalidatePath("/conta");
  return { ok: true, message: "Dados atualizados." };
}

export async function signOut(): Promise<void> {
  const db = await getSessionDb();
  await db.auth.signOut();
  redirect("/conta");
}
