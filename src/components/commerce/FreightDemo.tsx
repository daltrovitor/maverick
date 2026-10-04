// Hello World
"use client";

import { useId, useState, type FormEvent } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { FREE_SHIPPING_THRESHOLD, maskCep, quoteFreight, type FreightResult } from "@/lib/freight";
import { formatBRLCents } from "@/lib/format";

const CAP_PRICE = 159;
const MAX_ITEMS = 5;

export function FreightDemo() {
  const inputId = useId();
  const errorId = useId();
  const [cep, setCep] = useState("");
  const [items, setItems] = useState(1);
  const [result, setResult] = useState<FreightResult | null>(null);

  const subtotal = items * CAP_PRICE;
  const missingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(quoteFreight(cep, items, subtotal));
  };

  const changeItems = (delta: number) => {
    const next = Math.min(MAX_ITEMS, Math.max(1, items + delta));
    setItems(next);
    if (result?.ok) setResult(quoteFreight(cep, next, next * CAP_PRICE));
  };

  const error = result && !result.ok ? result.error : null;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          CEP de entrega
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            name="cep"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            onChange={(event) => setCep(maskCep(event.target.value))}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className="tabular min-h-12 w-full min-w-0 rounded-sm border border-line-strong bg-white px-4 font-mono text-base text-ink placeholder:text-muted focus-visible:border-ink"
          />
          <button
            type="submit"
            className="inline-flex min-h-12 shrink-0 items-center rounded-sm bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-espresso"
          >
            Calcular
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-ink-soft" id={`${inputId}-qty`}>
            Bonés no carrinho
          </span>
          <div className="flex items-center" role="group" aria-labelledby={`${inputId}-qty`}>
            <button
              type="button"
              onClick={() => changeItems(-1)}
              disabled={items <= 1}
              aria-label="Remover um boné"
              className="inline-flex size-12 items-center justify-center rounded-sm text-ink disabled:text-line-strong"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <output className="tabular w-8 text-center font-mono text-sm text-ink" aria-live="polite">
              {items}
            </output>
            <button
              type="button"
              onClick={() => changeItems(1)}
              disabled={items >= MAX_ITEMS}
              aria-label="Adicionar um boné"
              className="inline-flex size-12 items-center justify-center rounded-sm text-ink disabled:text-line-strong"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          {missingForFree > 0
            ? `Faltam ${formatBRLCents(missingForFree)} para frete grátis no PAC.`
            : "Frete grátis no PAC liberado para este carrinho."}
        </p>
      </form>

      <div aria-live="polite" className="min-h-[10.5rem]">
        {error && (
          <p id={errorId} role="alert" className="text-sm text-[#9b2c1f]">
            {error}
          </p>
        )}
        <AnimatePresence mode="wait">
          {result?.ok && (
            <m.div
              key={`${result.formatted}-${items}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                {result.formatted} · {result.region}
              </p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {result.quotes.map((quote) => (
                  <li key={quote.carrier} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {quote.carrier} <span className="font-normal text-muted">· {quote.company}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {quote.days.min}–{quote.days.max} dias úteis
                      </p>
                    </div>
                    <p className="tabular text-right text-sm text-ink">
                      {quote.free ? (
                        <>
                          <span className="mr-2 text-xs text-muted line-through">{formatBRLCents(quote.originalPrice)}</span>
                          <span className="font-medium text-success">Grátis</span>
                        </>
                      ) : (
                        formatBRLCents(quote.price)
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
