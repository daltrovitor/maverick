// Hello World
"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatCep, onlyDigits, ufName } from "@/lib/br";
import { rateFor } from "@/lib/shipping-pricing";
import { Button } from "@/components/ui/Button";
import { lookupCep, useDelivery } from "@/components/delivery/DeliveryProvider";

/** Fechado sem CEP nesta sessão: não reabre sozinho até a próxima visita. */
const DISMISS_KEY = "maverick.delivery-prompt.v1";

/** Páginas de vitrine, onde o preço muda com o CEP (o checkout tem o próprio campo). */
function autoPromptRoute(path: string): boolean {
  return path === "/" || path === "/loja" || path === "/carrinho" || path.startsWith("/produto/");
}

function dismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismiss(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // sem armazenamento: pode reabrir na próxima página, sem prejuízo
  }
}

const MESSAGES = {
  invalid: "Digite os 8 números do CEP.",
  not_found: "CEP não encontrado. Confira os números.",
  unavailable: "Não conseguimos consultar o CEP agora. Tente de novo em instantes.",
} as const;

/**
 * "Para onde vamos entregar?": pede o CEP uma vez (na primeira visita, depois da abertura da
 * marca) e o guarda no navegador; a partir daí os preços da loja já saem com o frete da região
 * e o cliente vê frete grátis. Painel discreto no canto (folha inferior no celular), sem bloquear
 * a página; também abre pelo botão de CEP do cabeçalho.
 */
export function DeliveryPrompt() {
  const { pricing, delivery, hydrated, setDelivery, promptOpen, promptFocus, openPrompt, closePrompt } = useDelivery();
  const pathname = usePathname();
  const titleId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "loading" } | { kind: "error"; message: string }>({ kind: "idle" });
  const active = pricing.inPrice && pricing.rates.length > 0;
  const currentRate = rateFor(pricing, delivery?.uf);

  // Primeira visita: abre sozinho nas páginas de vitrine, depois que a abertura da marca sai.
  useEffect(() => {
    if (!hydrated || !active || delivery || promptOpen || !autoPromptRoute(pathname) || dismissed()) return;
    const root = document.documentElement;
    const introBusy = () => root.dataset.intro === "playing" || root.dataset.intro === "leaving";
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => openPrompt({ focus: false }), 1400);
    };
    if (!introBusy()) {
      schedule();
      return () => window.clearTimeout(timer);
    }
    const observer = new MutationObserver(() => {
      if (introBusy()) return;
      observer.disconnect();
      schedule();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-intro"] });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [hydrated, active, delivery, promptOpen, pathname, openPrompt]);

  const close = useCallback(() => {
    if (!delivery) rememberDismiss();
    setStatus({ kind: "idle" });
    closePrompt();
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, [delivery, closePrompt]);

  // Aberto por clique: leva o foco ao campo (e devolve ao botão ao fechar).
  useEffect(() => {
    if (!promptOpen || !promptFocus) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
  }, [promptOpen, promptFocus]);

  useEffect(() => {
    if (!promptOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promptOpen, close]);

  if (!promptOpen || !active) return null;

  async function confirm(value: string) {
    setStatus({ kind: "loading" });
    const result = await lookupCep(value);
    if (!result.ok) {
      setStatus({ kind: "error", message: MESSAGES[result.reason] });
      return;
    }
    setDelivery(result.delivery);
    setCep("");
    if (!rateFor(pricing, result.delivery.uf)) {
      setStatus({
        kind: "error",
        message: `Ainda não entregamos em ${ufName(result.delivery.uf)}. Fale com a gente pelo WhatsApp.`,
      });
      return;
    }
    setStatus({ kind: "idle" });
    toast.success(`Preços atualizados para ${ufName(result.delivery.uf)}, com frete grátis.`);
    close();
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void confirm(cep);
  };

  const error = status.kind === "error" ? status.message : null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="animate-fade-up fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-paper px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-12px_40px_rgba(38,23,10,0.12)] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[380px] sm:rounded-sm sm:border sm:px-6 sm:pb-6 sm:shadow-[0_12px_40px_rgba(38,23,10,0.16)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="type-brand text-lg leading-tight">
          Para onde vamos entregar?
        </h2>
        <button
          type="button"
          onClick={close}
          className="-mt-2 -mr-2 grid size-12 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-soft hover:bg-cream-deep"
          aria-label="Fechar"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        {delivery && currentRate
          ? `Entrega em ${delivery.city ? `${delivery.city}/` : ""}${delivery.uf}, CEP ${formatCep(delivery.cep)}: frete grátis${
              currentRate.estimate ? `, ${currentRate.estimate}` : ""
            }.`
          : "Informe seu CEP: os preços já aparecem com o envio incluso e o frete sai grátis."}
      </p>
      <form onSubmit={submit} className="mt-4 flex gap-2" noValidate>
        <label htmlFor={`${titleId}-cep`} className="sr-only">
          CEP
        </label>
        <input
          ref={inputRef}
          id={`${titleId}-cep`}
          name="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={delivery ? "Outro CEP" : "00000-000"}
          maxLength={9}
          value={cep}
          onChange={(e) => {
            const digits = onlyDigits(e.target.value).slice(0, 8);
            setCep(formatCep(digits));
            if (status.kind === "error") setStatus({ kind: "idle" });
            if (digits.length === 8) void confirm(digits);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="tabular min-h-12 w-full min-w-0 rounded-sm border border-line-strong bg-paper px-3 text-base"
        />
        <Button type="submit" loading={status.kind === "loading"} disabled={onlyDigits(cep).length !== 8}>
          Confirmar
        </Button>
      </form>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          <a
            href="https://buscacepinter.correios.com.br/app/endereco/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer underline underline-offset-2 hover:text-ink"
          >
            Não sei meu CEP
          </a>
        </p>
      )}
    </section>
  );
}
