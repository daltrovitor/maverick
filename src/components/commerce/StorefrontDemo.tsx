// Hello World
"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { CapIllustration, type CapStyle } from "@/components/cap/CapIllustration";
import type { EditionId } from "@/components/cap/editions";
import { getTimeLeft, nextDropDate, type TimeLeft } from "@/lib/countdown";
import { formatBRLCents, pad2 } from "@/lib/format";

type CategoryId = "trucker" | "snapback" | "limited";

interface Product {
  readonly name: string;
  readonly edition: EditionId;
  readonly price: number;
  readonly note: string;
}

interface Category {
  readonly id: CategoryId;
  readonly label: string;
  readonly style: CapStyle;
  readonly description: string;
  readonly products: readonly Product[];
}

const CATEGORIES: readonly Category[] = [
  {
    id: "trucker",
    label: "Trucker Premium",
    style: "trucker",
    description: "Tela traseira respirável para o calor do campo.",
    products: [
      { name: "Trucker Black", edition: "black", price: 149, note: "Tela respirável" },
      { name: "Trucker Sand", edition: "sand", price: 149, note: "Tela respirável" },
      { name: "Trucker Hunter", edition: "hunter", price: 149, note: "Tela respirável" },
    ],
  },
  {
    id: "snapback",
    label: "Snapback Clássico",
    style: "snapback",
    description: "Aba estruturada e reta, ajuste snap.",
    products: [
      { name: "Snapback Black", edition: "black", price: 159, note: "Aba reta" },
      { name: "Snapback Sand", edition: "sand", price: 159, note: "Aba reta" },
      { name: "Snapback Hunter", edition: "hunter", price: 159, note: "Aba reta" },
    ],
  },
  {
    id: "limited",
    label: "Edições Limitadas",
    style: "structured",
    description: "Drops numerados de 100 unidades com cronômetro regressivo.",
    products: [
      { name: "Drop 002 · Black Gold", edition: "black", price: 219, note: "Nº 001–100" },
      { name: "Drop 002 · Leather", edition: "sand", price: 219, note: "Nº 001–100" },
      { name: "Drop 002 · Hunter", edition: "hunter", price: 219, note: "Nº 001–100" },
    ],
  },
];

const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

/** Cronômetro do drop: só assina o relógio enquanto a aba de edições limitadas está aberta. */
function useDropCountdown(enabled: boolean): TimeLeft | null {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const target = nextDropDate(new Date()).getTime();
    const update = () => setTimeLeft(getTimeLeft(target, Date.now()));
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [enabled]);
  return enabled ? timeLeft : null;
}

export function StorefrontDemo() {
  const [active, setActive] = useState<CategoryId>("trucker");
  const timeLeft = useDropCountdown(active === "limited");
  const category = CATEGORIES.find((item) => item.id === active) ?? CATEGORIES[0]!;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div role="tablist" aria-label="Categorias da loja" className="flex flex-wrap gap-x-1 border-b border-line">
        {CATEGORIES.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              onClick={() => setActive(item.id)}
              className={`relative min-h-12 px-3 text-sm transition-colors ${selected ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {item.label}
              {selected && <m.span layoutId="store-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" transition={SPRING} />}
            </button>
          );
        })}
      </div>

      <div id={`panel-${category.id}`} role="tabpanel" aria-labelledby={`tab-${category.id}`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-ink-soft">{category.description}</p>
          {category.id === "limited" && (
            <p className="flex items-baseline gap-2 font-mono text-xs text-ink" aria-live="off">
              <span className="uppercase tracking-[0.12em] text-muted">Drop em</span>
              <span className="tabular text-sm" suppressHydrationWarning>
                {timeLeft
                  ? `${pad2(timeLeft.days)}d ${pad2(timeLeft.hours)}h ${pad2(timeLeft.minutes)}m ${pad2(timeLeft.seconds)}s`
                  : "--d --h --m --s"}
              </span>
            </p>
          )}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <m.ul
            key={category.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING}
            className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3"
          >
            {category.products.map((product) => (
              <li key={product.name} className="group flex flex-col rounded-xs border border-line">
                <div className="overflow-hidden bg-cream px-3 pb-2 pt-4">
                  <CapIllustration
                    edition={product.edition}
                    style={category.style}
                    idPrefix={`store-${category.id}-${product.edition}`}
                    className="h-auto w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 p-3">
                  <p className="text-sm font-medium text-ink">{product.name}</p>
                  <p className="text-xs text-muted">{product.note}</p>
                  <p className="tabular mt-auto pt-2 text-sm text-ink">{formatBRLCents(product.price)}</p>
                </div>
              </li>
            ))}
          </m.ul>
        </AnimatePresence>
      </div>
    </div>
  );
}
