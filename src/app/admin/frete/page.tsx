// Hello World
import { ShippingEditor } from "@/components/admin/ShippingEditor";
import { ShippingModeToggle } from "@/components/admin/ShippingModeToggle";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Frete por estado" };

export default async function AdminShipping() {
  const { db } = await requireAdmin();
  const [{ data }, { data: settings }] = await Promise.all([
    db.from("shipping_rates").select("uf, price_cents, delivery_estimate, is_active").order("uf"),
    db.from("store_settings").select("*").maybeSingle(),
  ]);
  // Antes da migração do frete embutido a coluna não existe.
  const available = Boolean(settings && "shipping_in_price" in settings);
  const inPrice = settings?.shipping_in_price === true;
  return (
    <div>
      <AdminHeader
        title="Frete por estado"
        description={
          inPrice
            ? "Defina o valor de envio de cada UF. Ele é somado ao preço de cada boné para quem informa um CEP daquele estado; o checkout mostra frete grátis e o banco confirma os valores."
            : "Defina o valor do frete para cada UF. O checkout calcula pelo estado do endereço e o valor é confirmado no servidor."
        }
      />
      <ShippingModeToggle initial={inPrice} available={available} />
      <ShippingEditor initial={data ?? []} inPrice={inPrice} />
    </div>
  );
}
