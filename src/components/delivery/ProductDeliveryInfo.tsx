// Hello World
"use client";

import { formatBRL, ufName } from "@/lib/br";
import { rateFor } from "@/lib/shipping-pricing";
import { useDelivery } from "@/components/delivery/DeliveryProvider";

/** Bloco "Entrega" da página de produto: frete grátis (embutido) ou o valor cobrado à parte. */
export function ProductDeliveryInfo() {
  const { pricing, delivery, openPrompt } = useDelivery();
  const { rates } = pricing;

  if (rates.length === 0) {
    return <p className="mt-4 text-sm text-ink-soft">As regiões de entrega serão informadas no checkout.</p>;
  }

  const coverage = rates.length === 27 ? "todo o Brasil" : `${rates.length} estados`;
  const served =
    rates.length < 27 ? (
      <span className="mt-2 block text-xs text-muted">Atendidos: {rates.map((r) => ufName(r.uf)).join(", ")}.</span>
    ) : null;

  if (!pricing.inPrice) {
    const cheapest = Math.min(...rates.map((r) => r.cents));
    return (
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Entregamos em {coverage}, com frete a partir de {formatBRL(cheapest)}. O valor exato aparece no checkout pelo estado
        do endereço.
        {served}
      </p>
    );
  }

  const rate = rateFor(pricing, delivery?.uf);
  return (
    <div className="mt-4 text-sm leading-relaxed text-ink-soft">
      <p>
        Frete grátis para {coverage}: o envio já está incluso no preço, que se ajusta ao CEP de entrega.
        {served}
      </p>
      <p className="mt-3">
        {delivery && rate
          ? `Seu CEP: ${delivery.city ? `${delivery.city}/` : ""}${delivery.uf}${rate.estimate ? `, prazo estimado de ${rate.estimate}` : ""}.`
          : delivery
            ? `Ainda não entregamos em ${ufName(delivery.uf)}.`
            : "Informe o CEP para ver o preço final da sua região."}{" "}
        <button
          type="button"
          onClick={() => openPrompt()}
          className="cursor-pointer text-ink underline underline-offset-2 hover:text-gold-ink"
        >
          {delivery ? "Trocar CEP" : "Informar CEP"}
        </button>
      </p>
    </div>
  );
}
