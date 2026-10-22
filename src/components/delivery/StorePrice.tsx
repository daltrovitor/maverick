// Hello World
"use client";

import { MapPin } from "lucide-react";
import { formatBRL, formatCep, ufName } from "@/lib/br";
import { displayPrice, rateFor, unitPriceFor } from "@/lib/shipping-pricing";
import { useDelivery } from "@/components/delivery/DeliveryProvider";

/**
 * Preço de vitrine já com o frete da região do cliente (quando o frete entra no preço).
 * Sem CEP informado, mostra o menor valor possível como "a partir de".
 */
export function StorePrice({
  baseCents,
  compareAtCents = null,
  range = false,
  className,
  compareClassName,
}: {
  readonly baseCents: number;
  readonly compareAtCents?: number | null;
  /** O produto tem variantes com preços diferentes ("a partir de" de qualquer jeito). */
  readonly range?: boolean;
  readonly className?: string;
  readonly compareClassName?: string;
}) {
  const { pricing, delivery } = useDelivery();
  const price = displayPrice(baseCents, pricing, delivery?.uf);
  const compare = compareAtCents && !range ? displayPrice(compareAtCents, pricing, delivery?.uf).cents : null;
  return (
    <>
      {compare && compare > price.cents ? <span className={compareClassName}>{formatBRL(compare)}</span> : null}
      <span className={className}>
        {range || price.from ? "a partir de " : ""}
        {formatBRL(price.cents)}
      </span>
    </>
  );
}

/**
 * Converte valores-base da sacola no preço da região (frete por unidade, quando embutido). Sem
 * UF informada usa o destino guardado, e sem destino o menor valor possível, como a vitrine.
 */
export function useRegionalPrice(): (baseCents: number, uf?: string | null) => number {
  const { pricing, delivery } = useDelivery();
  return (baseCents, uf) =>
    uf ? unitPriceFor(baseCents, pricing, uf) : displayPrice(baseCents, pricing, delivery?.uf).cents;
}

/** Linha "frete grátis para SP" / "informe o CEP", com o atalho para trocar o CEP. */
export function FreeShippingNote({ className = "" }: { readonly className?: string }) {
  const { pricing, delivery, openPrompt } = useDelivery();
  if (!pricing.inPrice || pricing.rates.length === 0) return null;
  const rate = rateFor(pricing, delivery?.uf);
  const change = (
    <button
      type="button"
      onClick={() => openPrompt()}
      className="cursor-pointer underline underline-offset-2 hover:text-ink"
    >
      {delivery ? "trocar CEP" : "informe seu CEP"}
    </button>
  );
  if (!delivery) {
    return (
      <p className={className}>
        Frete grátis, já incluso no preço: {change} para ver o valor exato.
      </p>
    );
  }
  if (!rate) {
    return (
      <p className={className}>
        Ainda não entregamos em {ufName(delivery.uf)} · {change}
      </p>
    );
  }
  return (
    <p className={className}>
      Frete grátis para {ufName(delivery.uf)}
      {rate.estimate ? ` (${rate.estimate})` : ""} · {change}
    </p>
  );
}

/** Botão do cabeçalho: mostra a UF de entrega e abre o painel de CEP. */
export function DeliveryButton() {
  const { pricing, delivery, openPrompt } = useDelivery();
  if (!pricing.inPrice || pricing.rates.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => openPrompt()}
      className="type-micro inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-sm px-3 hover:opacity-80"
      aria-label={
        delivery ? `Entrega em ${ufName(delivery.uf)}, CEP ${formatCep(delivery.cep)}. Trocar CEP` : "Informar CEP de entrega"
      }
    >
      <MapPin className="size-4" aria-hidden="true" />
      <span className="tabular" aria-hidden="true">
        {delivery ? delivery.uf : "CEP"}
      </span>
    </button>
  );
}
