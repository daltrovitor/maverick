// Hello World
"use client";

import { Suspense, type ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CouponCapture } from "@/components/cart/CouponCapture";
import { ScrollRevealController } from "@/components/providers/ScrollRevealController";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";

const loadMotionFeatures = () => import("./motionFeatures").then((mod) => mod.default);

/** Provedores do site público (isolados do layout raiz, que segue Server Component). */
export function SiteProviders({ children }: { readonly children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <CartProvider>
          <SmoothScrollProvider>
            {children}
            <ScrollRevealController />
          </SmoothScrollProvider>
          <CartDrawer />
          <Suspense fallback={null}>
            <CouponCapture />
          </Suspense>
        </CartProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
