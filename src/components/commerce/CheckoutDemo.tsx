// Hello World
"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Check, CreditCard, QrCode } from "lucide-react";
import { CapIllustration } from "@/components/cap/CapIllustration";
import { formatBRLCents } from "@/lib/format";

type Method = "pix" | "card";
type CheckoutState =
  | { readonly status: "idle" }
  | { readonly status: "processing"; readonly method: Method }
  | { readonly status: "paid"; readonly method: Method; readonly seconds: number };

const PRICE = 159;
const PIX_CONFIRM_MS = 2400;
const CARD_CONFIRM_MS = 1200;
const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

/** Matriz determinística que imita um QR Code (apenas ilustrativa). */
function buildQrMatrix(size: number): boolean[][] {
  let seed = 1027;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const finder = (r: number, c: number): boolean | null => {
    const origins: Array<[number, number]> = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ];
    const box = origins.find(([r0, c0]) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7);
    if (!box) return null;
    const dr = r - box[0];
    const dc = c - box[1];
    const ring = Math.min(dr, dc, 6 - dr, 6 - dc);
    return ring === 0 || ring >= 2;
  };
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => finder(r, c) ?? next() > 0.52));
}

/** Todos os módulos do QR em um único <path> (1 nó no DOM em vez de ~330 <rect>). */
const QR_PATH = buildQrMatrix(25)
  .flatMap((row, r) => row.map((filled, c) => (filled ? `M${c} ${r}h1v1h-1z` : "")))
  .join("");

export function CheckoutDemo() {
  const [method, setMethod] = useState<Method>("pix");
  const [state, setState] = useState<CheckoutState>({ status: "idle" });

  useEffect(() => {
    if (state.status !== "processing") return;
    const duration = state.method === "pix" ? PIX_CONFIRM_MS : CARD_CONFIRM_MS;
    const timer = window.setTimeout(() => {
      setState({ status: "paid", method: state.method, seconds: duration / 1000 });
    }, duration);
    return () => window.clearTimeout(timer);
  }, [state]);

  const start = () => setState({ status: "processing", method });
  const reset = () => setState({ status: "idle" });

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-4 border-b border-line pb-5">
        <div className="w-20 shrink-0 rounded-xs bg-cream p-1.5">
          <CapIllustration edition="black" idPrefix="checkout" className="h-auto w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">Boné Maverick Black Edition</p>
          <p className="text-xs text-muted">Sarja · tamanho ajustável · 1 unidade</p>
        </div>
        <p className="tabular text-sm font-medium text-ink">{formatBRLCents(PRICE)}</p>
      </div>

      <div role="tablist" aria-label="Forma de pagamento" className="grid grid-cols-2 rounded-sm border border-line p-1">
        {(["pix", "card"] as const).map((option) => {
          const selected = method === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="checkout-panel"
              disabled={state.status === "processing"}
              onClick={() => {
                setMethod(option);
                reset();
              }}
              className={`relative flex min-h-12 items-center justify-center gap-2 text-sm transition-colors ${
                selected ? "text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {selected && (
                <m.span layoutId="checkout-method" className="absolute inset-0 rounded-xs bg-ink" transition={SPRING} />
              )}
              <span className="relative flex items-center gap-2">
                {option === "pix" ? <QrCode className="size-4" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                {option === "pix" ? "Pix" : "Cartão em 1 clique"}
              </span>
            </button>
          );
        })}
      </div>

      <div id="checkout-panel" role="tabpanel" className="flex min-h-[15rem] flex-1 flex-col" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {state.status === "paid" ? (
            <m.div
              key="paid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="flex flex-1 flex-col items-start justify-center gap-3"
            >
              <span className="flex size-10 items-center justify-center rounded-xs bg-success text-white">
                <Check className="size-5" aria-hidden="true" />
              </span>
              <p className="font-serif text-2xl text-ink">Pagamento confirmado.</p>
              <p className="text-sm leading-relaxed text-ink-soft">
                {state.method === "pix" ? "Pix compensado" : "Cartão aprovado"} em {state.seconds.toLocaleString("pt-BR")} s. Pedido
                #MAV-1027 já está no painel do lojista e o cliente recebeu a confirmação por e-mail.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-1 inline-flex min-h-12 items-center rounded-sm border border-line-strong px-4 text-sm text-ink transition-colors hover:border-ink"
              >
                Simular outra compra
              </button>
            </m.div>
          ) : method === "pix" ? (
            <m.div
              key="pix"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center"
            >
              <div className="relative mx-auto size-36 shrink-0 rounded-xs border border-line bg-white p-2 sm:mx-0">
                <svg viewBox="0 0 25 25" className={`size-full transition-opacity duration-500 ${state.status === "idle" ? "opacity-15" : "opacity-100"}`} role="img" aria-label="QR Code Pix de demonstração" shapeRendering="crispEdges">
                  <path d={QR_PATH} fill="#1f1612" />
                </svg>
              </div>
              <div className="flex flex-1 flex-col gap-3">
                {state.status === "idle" ? (
                  <>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      QR Code e código copia-e-cola gerados na hora. A confirmação chega por webhook, sem o cliente sair da página.
                    </p>
                    <button
                      type="button"
                      onClick={start}
                      className="inline-flex min-h-12 items-center justify-center rounded-sm bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-espresso"
                    >
                      Gerar Pix de {formatBRLCents(PRICE)}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-ink">Aguardando pagamento…</p>
                    <div className="h-0.5 w-full overflow-hidden bg-line" aria-hidden="true">
                      <m.div
                        className="h-full origin-left bg-ink"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: PIX_CONFIRM_MS / 1000, ease: "linear" }}
                      />
                    </div>
                    <p className="break-all font-mono text-[11px] leading-relaxed text-muted">
                      00020126580014br.gov.bcb.pix0136maverick-demo-1027520400005303986540515900
                    </p>
                  </>
                )}
              </div>
            </m.div>
          ) : (
            <m.div
              key="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="flex flex-1 flex-col justify-center gap-4"
            >
              <div className="flex items-center justify-between rounded-xs border border-line px-4 py-3">
                <span className="flex items-center gap-3 text-sm text-ink">
                  <CreditCard className="size-4 text-muted" aria-hidden="true" />
                  Cartão salvo · final 4242
                </span>
                <span className="text-xs text-muted">ou 3× de {formatBRLCents(PRICE / 3)}</span>
              </div>
              <button
                type="button"
                onClick={start}
                disabled={state.status === "processing"}
                className="inline-flex min-h-12 items-center justify-center rounded-sm bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-espresso disabled:opacity-70"
              >
                {state.status === "processing" ? "Processando…" : `Pagar ${formatBRLCents(PRICE)} em 1 clique`}
              </button>
              <p className="text-xs leading-relaxed text-muted">Tokenização segura no gateway: o cliente recorrente compra sem digitar o cartão.</p>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
