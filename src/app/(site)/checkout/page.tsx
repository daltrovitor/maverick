// Hello World
import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/catalog";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const [settings, user] = await Promise.all([getStoreSettings(), getCurrentUser()]);
  const pixAvailable = Boolean(settings?.pix_key && settings.pix_holder_name && settings.pix_city);
  const cardAvailable = Boolean(settings?.card_enabled) && isStripeConfigured();

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 pb-24 sm:px-8 sm:pt-14">
      <h1 className="type-monument text-[clamp(2.75rem,8vw,6rem)]">Checkout</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Seus dados são usados somente para processar e entregar este pedido.
      </p>
      <CheckoutForm
        pixAvailable={pixAvailable}
        cardAvailable={cardAvailable}
        pixHours={settings?.pix_expiration_hours ?? 24}
        prefill={{
          name: user?.profile?.full_name ?? "",
          email: user?.email ?? "",
          phone: user?.profile?.phone ?? "",
        }}
      />
    </div>
  );
}
