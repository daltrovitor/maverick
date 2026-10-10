// Hello World
"use client";

import { useState, useTransition } from "react";
import { respondAffiliate } from "@/app/(site)/afiliados/actions";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";

export function AffiliateResponseForm({ token }: { readonly token: string }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-6 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await respondAffiliate(token, text)));
      }}
    >
      <TextAreaField label="Sua resposta" value={text} onChange={(e) => setText(e.target.value)} minLength={10} maxLength={2000} required />
      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={result?.ok} className="justify-self-start">
        Enviar resposta
      </Button>
    </form>
  );
}
