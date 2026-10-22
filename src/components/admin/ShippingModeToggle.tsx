// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveShippingMode } from "@/app/admin/actions/store";
import { CheckboxField } from "@/components/ui/Field";

/** Chave do frete embutido: o valor de cada UF entra no preço de cada boné e o cliente vê frete grátis. */
export function ShippingModeToggle({ initial, available }: { readonly initial: boolean; readonly available: boolean }) {
  const router = useRouter();
  const [inPrice, setInPrice] = useState(initial);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    setInPrice(next);
    startTransition(async () => {
      const result = await saveShippingMode(next);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        setInPrice(!next);
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="mb-4 rounded-sm border border-line bg-paper p-4">
      <CheckboxField
        label={
          <>
            <span className="font-medium text-ink">Frete embutido no preço (cliente vê frete grátis)</span>
            <span className="mt-1 block text-xs text-muted">
              O valor de cada estado é somado ao preço de cada boné. Quem informa o CEP já vê os preços da sua região e o
              checkout mostra frete grátis. Desligado, o valor é cobrado à parte, uma vez por pedido.
            </span>
          </>
        }
        checked={inPrice}
        disabled={pending || !available}
        onChange={(e) => change(e.target.checked)}
      />
      {!available ? (
        <p className="mt-2 text-xs text-gold-ink">
          Aplique no Supabase a migração <code>20261022120000_shipping_in_price.sql</code> para ativar esta opção.
        </p>
      ) : null}
    </div>
  );
}
