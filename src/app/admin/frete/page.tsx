// Hello World
import { ShippingEditor } from "@/components/admin/ShippingEditor";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Frete por estado" };

export default async function AdminShipping() {
  const { db } = await requireAdmin();
  const { data } = await db.from("shipping_rates").select("uf, price_cents, delivery_estimate, is_active").order("uf");
  return (
    <div>
      <AdminHeader
        title="Frete por estado"
        description="Defina o valor do frete para cada UF. O checkout calcula pelo estado do endereço e o valor é confirmado no servidor."
      />
      <ShippingEditor initial={data ?? []} />
    </div>
  );
}
