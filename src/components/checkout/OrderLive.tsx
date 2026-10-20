// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Atualiza a página periodicamente enquanto o pagamento não é confirmado. */
export function OrderAutoRefresh({ seconds = 20 }: { readonly seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}

/** Contagem regressiva ancorada no relógio do servidor (o prazo real é validado no banco). */
export function Deadline({ expiresAt, serverNow }: { readonly expiresAt: string; readonly serverNow: string }) {
  // Sem relógio no render do servidor: o valor só existe após montar (evita divergência de hidratação).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);
  if (now === null) return <span className="tabular">--:--:--</span>;
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="tabular" aria-label={`Tempo restante: ${h} horas e ${m} minutos`}>
      {remaining === 0 ? "prazo encerrado" : `${pad(h)}:${pad(m)}:${pad(s)}`}
    </span>
  );
}

export function CopyButton({ value, label }: { readonly value: string; readonly label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      className="w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Código copiado" : label}</span>
    </Button>
  );
}
