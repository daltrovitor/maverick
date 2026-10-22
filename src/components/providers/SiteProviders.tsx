// Hello World
"use client";

import { Suspense, type ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CouponCapture } from "@/components/cart/CouponCapture";
import { DeliveryPrompt } from "@/components/delivery/DeliveryPrompt";
import { DeliveryProvider } from "@/components/delivery/DeliveryProvider";
import { ScrollRevealController } from "@/components/providers/ScrollRevealController";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import type { ShippingPricing } from "@/lib/shipping-pricing";

const loadMotionFeatures = () => import("./motionFeatures").then((mod) => mod.default);

/** Provedores do site público (isolados do layout raiz, que segue Server Component). */
export function SiteProviders({ pricing, children }: { readonly pricing: ShippingPricing; readonly children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <DeliveryProvider pricing={pricing}>
          <CartProvider>
            <SmoothScrollProvider>
              {children}
              <ScrollRevealController />
            </SmoothScrollProvider>
            <CartDrawer />
            <DeliveryPrompt />
            <Suspense fallback={null}>
              <CouponCapture />
            </Suspense>
          </CartProvider>
        </DeliveryProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
