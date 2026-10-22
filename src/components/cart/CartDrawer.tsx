// Hello World
"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { formatBRL } from "@/lib/br";
import { ButtonLink } from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { useDelivery } from "@/components/delivery/DeliveryProvider";
import { FreeShippingNote, useRegionalPrice } from "@/components/delivery/StorePrice";
import { CartLines } from "@/components/cart/CartLines";

/**
 * Sacola lateral em <dialog> nativo: foco preso, ESC fecha e o fundo fica inerte
 * sem bibliotecas extras.
 */
export function CartDrawer() {
  const { isOpen, close, lines, notice, refreshing, refresh } = useCart();
  const { pricing } = useDelivery();
  const regional = useRegionalPrice();
  const shippingInPrice = pricing.inPrice && pricing.rates.length > 0;
  const regionalSubtotal = lines.reduce((sum, l) => sum + regional(l.unitPriceCents) * l.quantity, 0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      void refresh();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen, refresh]);

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      onClick={(e) => {
        if (e.target === dialogRef.current) close();
      }}
      aria-labelledby="cart-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md bg-paper p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:animate-[cart-in_0.45s_var(--ease-out-expo)]"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="type-brand text-lg">
            Sacola
          </h2>
          <button
            type="button"
            onClick={close}
            className="grid size-12 place-items-center rounded-sm text-ink-soft hover:bg-cream-deep"
            aria-label="Fechar sacola"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5" data-lenis-prevent>
          {notice ? (
            <p role="status" className="mt-4 rounded-xs border border-gold/40 bg-[#fbf3e1] px-3 py-2 text-sm text-gold-ink">
              {notice}
            </p>
          ) : null}
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 py-16 text-center">
              <p className="text-ink-soft">{refreshing ? "Atualizando sua sacola…" : "Sua sacola está vazia."}</p>
              {!refreshing ? (
                <ButtonLink href="/loja" variant="secondary" onClick={close}>
                  Explorar a coleção
                </ButtonLink>
              ) : null}
            </div>
          ) : (
            <CartLines onNavigate={close} />
          )}
        </div>

        {lines.length > 0 ? (
          <footer className="border-t border-line px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-soft">Subtotal</span>
              <span className="tabular text-lg font-semibold">{formatBRL(regionalSubtotal)}</span>
            </div>
            {shippingInPrice ? (
              <FreeShippingNote className="mt-1 text-xs text-muted" />
            ) : (
              <p className="mt-1 text-xs text-muted">Frete e cupom são calculados no checkout.</p>
            )}
            <div className="mt-4 grid gap-2">
              <ButtonLink href="/checkout" onClick={close} size="lg">
                Finalizar compra
              </ButtonLink>
              <ButtonLink href="/carrinho" variant="ghost" onClick={close}>
                Ver sacola completa
              </ButtonLink>
            </div>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
