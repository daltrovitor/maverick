// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import { confirmCardReturn, startCardPayment } from "@/app/(site)/pedido/[token]/actions";
import { Button, Spinner } from "@/components/ui/Button";

let stripePromise: Promise<Stripe | null> | null = null;

/** Stripe.js carregado uma única vez, direto de js.stripe.com (exigência PCI). */
function getStripeJs(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key, { locale: "pt-BR" });
  return stripePromise;
}

/** Tokens da marca aplicados ao iframe do Stripe (cantos retos, café sobre branco). */
const APPEARANCE: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#26170a",
    colorText: "#26170a",
    colorTextSecondary: "#4f3f30",
    colorDanger: "#a4271b",
    colorBackground: "#ffffff",
    fontFamily: "Archivo, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    borderRadius: "4px",
    spacingUnit: "4px",
    focusBoxShadow: "0 0 0 2px #86611d",
  },
  rules: {
    ".Input": { borderColor: "#d3c6b0", boxShadow: "none", padding: "14px" },
    ".Input:focus": { borderColor: "#26170a" },
    ".Label": { fontWeight: "500" },
  },
};

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; clientSecret: string }
  | { kind: "settled"; status: "paid" | "processing" }
  | { kind: "error"; message: string };

/**
 * Pagamento com cartão de crédito ou débito dentro do site (Stripe Payment Element).
 * Os dados do cartão vão do navegador direto ao Stripe; a loja só recebe o resultado.
 */
export function StripeCardPayment({ token, totalLabel }: { readonly token: string; readonly totalLabel: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const stripe = getStripeJs();

  useEffect(() => {
    let cancelled = false;
    startCardPayment(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) setPhase({ kind: "error", message: result.message });
      else if ("clientSecret" in result) setPhase({ kind: "ready", clientSecret: result.clientSecret });
      else {
        setPhase({ kind: "settled", status: result.settled });
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt, router]);

  if (!stripe) {
    return <p className="text-sm text-danger">O pagamento com cartão não está configurado nesta loja.</p>;
  }
  if (phase.kind === "loading") {
    return (
      <p className="flex min-h-12 items-center gap-3 text-sm text-ink-soft" role="status">
        <Spinner /> Abrindo o pagamento seguro…
      </p>
    );
  }
  if (phase.kind === "error") {
    return (
      <div className="grid gap-3">
        <p role="alert" className="text-sm text-danger">
          {phase.message}
        </p>
        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => {
            setPhase({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (phase.kind === "settled") {
    return (
      <p className="text-ink-soft" role="status">
        {phase.status === "paid"
          ? "Pagamento aprovado. Atualizando seu pedido…"
          : "Pagamento em processamento pelo banco. Esta página atualiza sozinha."}
      </p>
    );
  }

  return (
    <Elements stripe={stripe} options={{ clientSecret: phase.clientSecret, appearance: APPEARANCE, locale: "pt-BR" }}>
      <CardForm token={token} totalLabel={totalLabel} onSettled={(status) => setPhase({ kind: "settled", status })} />
    </Elements>
  );
}

function CardForm({
  token,
  totalLabel,
  onSettled,
}: {
  readonly token: string;
  readonly totalLabel: string;
  readonly onSettled: (status: "paid" | "processing") => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || pending) return;
    setPending(true);
    setError(null);
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/pedido/${token}?pagamento=retorno` },
      // Cartão não sai do site; só métodos de redirecionamento (nenhum habilitado aqui) sairiam.
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message ?? "Pagamento não autorizado. Confira os dados ou use outro cartão.");
      setPending(false);
      return;
    }
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      const result = await confirmCardReturn(token);
      onSettled(result.status === "paid" ? "paid" : "processing");
      router.refresh();
      return;
    }
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }}
      />
      {error ? (
        <p role="alert" className="rounded-xs border border-danger/30 bg-[#fbeeed] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!stripe || !ready}>
        Pagar {totalLabel}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted">
        Crédito ou débito. Processado pelo Stripe com criptografia; os dados do cartão não passam pela loja.
      </p>
    </form>
  );
}
