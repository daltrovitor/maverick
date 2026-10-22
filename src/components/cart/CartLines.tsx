// Hello World
"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { formatBRL } from "@/lib/br";
import { useCart, type CartLine } from "@/components/cart/CartProvider";
import { useRegionalPrice } from "@/components/delivery/StorePrice";

function QuantityStepper({ line }: { readonly line: CartLine }) {
  const { setQuantity } = useCart();
  const max = Math.min(line.stock, 20);
  return (
    <div className="inline-flex items-center rounded-sm border border-line-strong" role="group" aria-label={`Quantidade de ${line.name}`}>
      <button
        type="button"
        className="grid size-11 place-items-center text-ink-soft transition-colors hover:bg-cream-deep disabled:opacity-40"
        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
        aria-label="Diminuir quantidade"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="tabular min-w-8 text-center text-sm font-medium" aria-live="polite">
        {line.quantity}
      </span>
      <button
        type="button"
        className="grid size-11 place-items-center text-ink-soft transition-colors hover:bg-cream-deep disabled:opacity-40"
        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
        disabled={line.quantity >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function CartLines({ onNavigate }: { readonly onNavigate?: () => void }) {
  const { lines, remove } = useCart();
  const regional = useRegionalPrice();
  return (
    <ul className="divide-y divide-line">
      {lines.map((line) => (
        <li key={line.variantId} className="flex gap-4 py-5">
          <Link
            href={`/produto/${line.slug}`}
            onClick={onNavigate}
            className="relative block size-24 shrink-0 overflow-hidden rounded-xs bg-cream"
          >
            {line.imageUrl ? (
              <Image src={line.imageUrl} alt={line.name} fill sizes="96px" className="object-contain p-1.5" />
            ) : null}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/produto/${line.slug}`} onClick={onNavigate} className="block truncate font-medium hover:underline">
                  {line.name}
                </Link>
                {line.variantLabel ? <p className="mt-0.5 text-sm text-muted">{line.variantLabel}</p> : null}
              </div>
              <p className="tabular shrink-0 text-sm font-medium">{formatBRL(regional(line.unitPriceCents) * line.quantity)}</p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
              <QuantityStepper line={line} />
              <button
                type="button"
                onClick={() => remove(line.variantId)}
                className="min-h-11 px-2 text-sm text-muted underline-offset-4 hover:text-danger hover:underline"
              >
                Remover
              </button>
            </div>
            {line.quantity >= line.stock ? (
              <p className="mt-2 text-xs text-gold-ink">Última(s) unidade(s) disponível(is).</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
