// Hello World
"use client";

import { useActionState, useState } from "react";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  updateProfile,
  type FormResult,
} from "@/app/(site)/conta/actions";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

const INITIAL: FormResult = { ok: false, message: "" };

function Feedback({ state }: { readonly state: FormResult }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-xs border px-3 py-2 text-sm ${
        state.ok ? "border-success/30 bg-[#eef5ef] text-success" : "border-danger/30 bg-[#fbeeed] text-danger"
      }`}
    >
      {state.message}
    </p>
  );
}

type Tab = "entrar" | "criar" | "recuperar";

export function AuthPanel({ next, notice }: { readonly next: string; readonly notice?: string }) {
  const [tab, setTab] = useState<Tab>("entrar");
  const [loginState, loginAction, loginPending] = useActionState(signIn, INITIAL);
  const [signupState, signupAction, signupPending] = useActionState(signUp, INITIAL);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, INITIAL);

  const tabs: { id: Tab; label: string }[] = [
    { id: "entrar", label: "Entrar" },
    { id: "criar", label: "Criar conta" },
    { id: "recuperar", label: "Esqueci a senha" },
  ];

  return (
    <div className="mx-auto max-w-md">
      {notice ? (
        <p role="alert" className="mb-6 rounded-xs border border-gold/40 bg-[#fbf3e1] px-3 py-2 text-sm text-gold-ink">
          {notice}
        </p>
      ) : null}
      <div role="tablist" aria-label="Acesso" className="grid grid-cols-3 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`type-micro min-h-12 border-b-2 px-2 transition-colors ${
              tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-8">
        {tab === "entrar" ? (
          <form id="panel-entrar" role="tabpanel" aria-labelledby="tab-entrar" action={loginAction} className="grid gap-5">
            <input type="hidden" name="proximo" value={next} />
            <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
            <TextField label="Senha" name="password" type="password" autoComplete="current-password" required />
            <Feedback state={loginState} />
            <Button type="submit" size="lg" loading={loginPending}>
              Entrar
            </Button>
          </form>
        ) : null}
        {tab === "criar" ? (
          <form id="panel-criar" role="tabpanel" aria-labelledby="tab-criar" action={signupAction} className="grid gap-5">
            <TextField label="Nome completo" name="fullName" autoComplete="name" required />
            <TextField label="E-mail" name="email" type="email" autoComplete="email" required />
            <TextField
              label="Senha"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              hint="Mínimo de 8 caracteres."
            />
            <Feedback state={signupState} />
            <Button type="submit" size="lg" loading={signupPending}>
              Criar conta
            </Button>
          </form>
        ) : null}
        {tab === "recuperar" ? (
          <form id="panel-recuperar" role="tabpanel" aria-labelledby="tab-recuperar" action={resetAction} className="grid gap-5">
            <TextField label="E-mail da conta" name="email" type="email" autoComplete="email" required />
            <Feedback state={resetState} />
            <Button type="submit" size="lg" loading={resetPending}>
              Enviar link
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileForm({ fullName, phone }: { readonly fullName: string; readonly phone: string }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  return (
    <form action={action} className="grid gap-5">
      <TextField label="Nome completo" name="fullName" defaultValue={fullName} autoComplete="name" required />
      <TextField label="WhatsApp" name="phone" type="tel" defaultValue={phone} autoComplete="tel-national" />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" loading={pending}>
        Salvar dados
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);
  return (
    <form action={action} className="grid gap-5">
      <TextField label="Nova senha" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <TextField label="Repita a nova senha" name="confirm" type="password" autoComplete="new-password" required />
      <Feedback state={state} />
      <Button type="submit" size="lg" loading={pending}>
        Salvar nova senha
      </Button>
    </form>
  );
}
