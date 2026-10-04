// Hello World
"use client";

import { useMemo, useState } from "react";
import * as m from "motion/react-m";
import { Check } from "lucide-react";
import { GymIllustration } from "@/components/sections/GymIllustrations";
import { GYM_PRODUCTS } from "@/lib/content";
import { formatBRLCents, formatPercent } from "@/lib/format";
import { BASE_CAP_PRICE, summarizeKit, type GymItemId } from "@/lib/gym";

const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;
const BRONZE = "#9a6a1c";
const BASELINE = "#b8ada2";

export function GymKitBuilder() {
  const [selected, setSelected] = useState<readonly GymItemId[]>(["camiseta"]);
  const kit = useMemo(() => summarizeKit(selected), [selected]);
  const scaleMax = Math.max(kit.total, 700);

  const toggle = (id: GymItemId) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const bars = [
    { key: "base", label: "Hoje · só o boné", value: BASE_CAP_PRICE, color: BASELINE },
    { key: "kit", label: "Com a linha Gym", value: kit.total, color: BRONZE },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-8">
      <fieldset className="lg:col-span-8">
        <legend className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Monte o kit sobre o boné Maverick</legend>
        <ul className="mt-4 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          {GYM_PRODUCTS.map((product) => {
            const checked = selected.includes(product.id);
            return (
              <li key={product.id}>
                <label
                  className={`group flex h-full cursor-pointer flex-col rounded-sm border bg-white transition-colors ${
                    checked ? "border-ink" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(product.id)} className="peer sr-only" />
                  <span className="relative block bg-cream px-14 pb-3 pt-6 peer-focus-visible:outline-2 peer-focus-visible:outline-cobalt sm:px-16">
                    <span className="block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
                      <GymIllustration id={product.id} />
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute right-3 top-3 flex size-6 items-center justify-center rounded-xs border transition-colors ${
                        checked ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-transparent"
                      }`}
                    >
                      <Check className="size-3.5" />
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-4">
                    <span className="text-[15px] font-medium text-ink">{product.name}</span>
                    <span className="text-sm leading-relaxed text-muted">{product.spec}</span>
                    <span className="tabular mt-auto pt-2 text-sm text-ink">{formatBRLCents(product.price)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-4 lg:self-start lg:pt-8">
        <div>
          <p className="text-sm text-muted">Ticket médio do pedido</p>
          <p className="tabular mt-1 text-5xl font-semibold tracking-tight text-ink" aria-live="polite">
            {formatBRLCents(kit.total)}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {kit.upliftVsCap > 0 ? `${formatPercent(kit.upliftVsCap)} acima de um pedido só com boné` : "Igual a um pedido só com boné"}
            {kit.comboApplied ? ` · combo boné + camiseta por ${formatBRLCents(420)}` : ""}
          </p>
        </div>

        <figure className="flex flex-col gap-3">
          <figcaption className="text-sm font-medium text-ink">Ticket por pedido</figcaption>
          {bars.map((bar) => (
            <div key={bar.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="flex items-center gap-2 text-ink-soft">
                  <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: bar.color }} />
                  {bar.label}
                </span>
                <span className="tabular font-medium text-ink">{formatBRLCents(bar.value)}</span>
              </div>
              <div className="h-5 w-full bg-surface">
                <m.div
                  className="h-full rounded-r-[4px]"
                  style={{ backgroundColor: bar.color, originX: 0 }}
                  initial={false}
                  animate={{ width: `${(bar.value / scaleMax) * 100}%` }}
                  transition={SPRING}
                />
              </div>
            </div>
          ))}
        </figure>
        <p className="text-xs leading-relaxed text-muted">
          O mesmo público que usa o boné treina pesado: cada peça Gym aumenta o valor do pedido sem custo extra de aquisição.
        </p>
      </div>
    </div>
  );
}
