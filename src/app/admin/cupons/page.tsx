// Hello World
import { CouponManager } from "@/components/admin/CouponManager";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Cupons" };

export default async function AdminCoupons() {
  const { db } = await requireAdmin();
  const [{ data: coupons }, { data: affiliates }] = await Promise.all([
    db.from("coupons").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("affiliate_applications").select("id, full_name").eq("status", "approved"),
  ]);
  const affiliateNames = Object.fromEntries((affiliates ?? []).map((a) => [a.id, a.full_name]));
  return (
    <div>
      <AdminHeader
        title="Cupons"
        description="Cupons de afiliados são gerados automaticamente na aprovação (25%, 24h). Aqui você também cria cupons próprios da loja."
      />
      <CouponManager coupons={coupons ?? []} affiliateNames={affiliateNames} serverNow={new Date().toISOString()} />
    </div>
  );
}
