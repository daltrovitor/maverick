// Hello World
import type { Metadata } from "next";
import { CartPageView } from "@/components/cart/CartPageView";

export const metadata: Metadata = {
  title: "Sacola",
  robots: { index: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-24 sm:px-8 sm:pt-16">
      <h1 className="type-monument text-[clamp(3rem,10vw,7rem)]">Sacola</h1>
      <CartPageView />
    </div>
  );
}
