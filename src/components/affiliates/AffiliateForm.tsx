// Hello World
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { formatCpf } from "@/lib/br";
import { AFFILIATE_CHANNELS, AFFILIATE_PLATFORMS } from "@/lib/validation";
import { submitAffiliate } from "@/app/(site)/afiliados/actions";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";

export function AffiliateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const alertRef = useRef<HTMLParagraphElement>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await submitAffiliate({
        fullName: f.get("fullName"),
        cpf: f.get("cpf"),
        phone: f.get("phone"),
        email: f.get("email"),
        platform: f.get("platform"),
        profileUrl: f.get("profileUrl"),
        followersDeclared: f.get("followersDeclared"),
        audience: f.get("audience"),
        salesForecastMonthly: f.get("salesForecastMonthly"),
        salesForecastBasis: f.get("salesForecastBasis"),
        strategy: f.get("strategy"),
        channels,
        truthConfirmed: f.get("truthConfirmed") === "on",
        privacyConsent: f.get("privacyConsent") === "on",
      });
      if (result.ok) {
        router.push(result.statusPath);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setMessage(result.message);
      requestAnimationFrame(() => alertRef.current?.focus());
    });
  };

  const e = (k: string) => errors[k] ?? null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10">
      {message ? (
        <p ref={alertRef} tabIndex={-1} role="alert" className="rounded-xs border border-danger/30 bg-[#fbeeed] px-4 py-3 text-sm text-danger">
          {message}
        </p>
      ) : null}

      <fieldset className="grid gap-5">
        <legend className="type-micro mb-2 text-ink-soft">01 · Identificação</legend>
        <TextField label="Nome completo" name="fullName" autoComplete="name" required error={e("fullName")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="CPF"
            name="cpf"
            inputMode="numeric"
            required
            value={cpf}
            onChange={(ev) => setCpf(formatCpf(ev.target.value))}
            maxLength={14}
            error={e("cpf")}
            hint="Usado só para validar sua identidade e evitar cadastros duplicados."
          />
          <TextField label="Telefone (WhatsApp)" name="phone" type="tel" autoComplete="tel-national" placeholder="(62) 99999-0000" required error={e("phone")} />
        </div>
        <TextField label="E-mail" name="email" type="email" autoComplete="email" required error={e("email")} />
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="type-micro mb-2 text-ink-soft">02 · Perfil público</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Rede principal" name="platform" required defaultValue="instagram" error={e("platform")}>
            {AFFILIATE_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Seguidores (aproximado)"
            name="followersDeclared"
            type="number"
            inputMode="numeric"
            min={1000}
            required
            error={e("followersDeclared")}
            hint="Mínimo de 1.000. Conferimos no perfil durante a análise."
          />
        </div>
        <TextField label="Link do perfil" name="profileUrl" type="url" placeholder="https://instagram.com/seuperfil" required error={e("profileUrl")} />
        <TextAreaField label="Quem é o seu público?" name="audience" required minLength={20} maxLength={1000}
          hint="Ex.: faixa etária, cidade/região, interesses." error={e("audience")} />
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="type-micro mb-2 text-ink-soft">03 · Plano de vendas</legend>
        <TextField
          label="Previsão realista de vendas por mês (unidades)"
          name="salesForecastMonthly"
          type="number"
          inputMode="numeric"
          min={1}
          required
          error={e("salesForecastMonthly")}
        />
        <TextAreaField label="Em que você baseia essa previsão?" name="salesForecastBasis" required minLength={20} maxLength={1000}
          hint="Ex.: resultados de divulgações anteriores, engajamento médio, histórico de vendas." error={e("salesForecastBasis")} />
        <TextAreaField label="Como pretende divulgar?" name="strategy" required minLength={20} maxLength={2000} error={e("strategy")} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Canais que vai usar</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {AFFILIATE_CHANNELS.map((c) => (
              <label key={c.value} className="flex min-h-11 items-center gap-3 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  className="size-5 accent-ink"
                  checked={channels.includes(c.value)}
                  onChange={(ev) =>
                    setChannels((list) => (ev.target.checked ? [...list, c.value] : list.filter((v) => v !== c.value)))
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
          {e("channels") ? (
            <p role="alert" className="mt-1 text-xs font-medium text-danger">
              {e("channels")}
            </p>
          ) : null}
        </fieldset>
      </fieldset>

      <fieldset className="grid gap-2 border-t border-line pt-6">
        <legend className="sr-only">Confirmações</legend>
        <CheckboxField name="truthConfirmed" required error={e("truthConfirmed")}
          label="Confirmo que as informações acima são verdadeiras e posso comprovar a audiência informada." />
        <CheckboxField
          name="privacyConsent"
          required
          error={e("privacyConsent")}
          label={
            <>
              Autorizo o uso destes dados para análise da candidatura e contato, conforme a{" "}
              <Link href="/politicas/privacidade" className="underline" target="_blank">
                Política de Privacidade
              </Link>
              .
            </>
          }
        />
      </fieldset>

      <Button type="submit" size="lg" loading={pending} className="justify-self-start">
        Enviar candidatura
      </Button>
    </form>
  );
}
