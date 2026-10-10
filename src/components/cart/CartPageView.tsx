// Hello World
"use client";

import { formatBRL } from "@/lib/br";
import { ButtonLink } from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { CartLines } from "@/components/cart/CartLines";

export function CartPageView() {
  const { lines, subtotalCents, ready, refreshing, notice } = useCart();

  if (!ready || (refreshing && lines.length === 0)) {
    return <p className="mt-10 text-ink-soft" role="status">Carregando sua sacola…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-xs border border-line bg-cream px-6 py-16 text-center">
        <p className="text-ink-soft">Sua sacola está vazia.</p>
        <ButtonLink href="/loja" variant="secondary" className="mt-6">
          Explorar a coleção
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-8">
        {notice ? (
          <p role="status" className="mb-4 rounded-xs border border-gold/40 bg-[#fbf3e1] px-3 py-2 text-sm text-gold-ink">
            {notice}
          </p>
        ) : null}
        <div className="border-y border-line">
          <CartLines />
        </div>
      </div>
      <aside className="lg:col-span-4" aria-label="Resumo">
        <div className="rounded-xs border border-line bg-cream p-6 lg:sticky lg:top-28">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-soft">Subtotal</span>
            <span className="tabular text-xl font-semibold">{formatBRL(subtotalCents)}</span>
          </div>
          <p className="mt-2 text-sm text-muted">O frete é calculado pelo estado do endereço no checkout.</p>
          <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
            Finalizar compra
          </ButtonLink>
          <ButtonLink href="/loja" variant="ghost" className="mt-2 w-full">
            Continuar comprando
          </ButtonLink>
        </div>
      </aside>
    </div>
  );
}
