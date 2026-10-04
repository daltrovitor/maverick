// Hello World
"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import { ScrollRevealController } from "@/components/providers/ScrollRevealController";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";

const loadMotionFeatures = () => import("./motionFeatures").then((mod) => mod.default);

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <SmoothScrollProvider>
          {children}
          <ScrollRevealController />
        </SmoothScrollProvider>
      </LazyMotion>
    </MotionConfig>
  );
}
