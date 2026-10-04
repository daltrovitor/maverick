// Hello World
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const HEADER_OFFSET = -76;

/** Instância global do Lenis sincronizada ao ticker do GSAP (um único loop RAF). */
function LenisRoot() {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const lenis = lenisRef.current?.lenis;
    if (!lenis) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPreference = () => {
      lenis.options.smoothWheel = !reducedMotion.matches;
    };
    applyMotionPreference();
    reducedMotion.addEventListener("change", applyMotionPreference);

    const offScroll = lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      reducedMotion.removeEventListener("change", applyMotionPreference);
      offScroll();
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        lerp: 0.08,
        duration: 1.2,
        autoRaf: false,
        anchors: { offset: HEADER_OFFSET },
      }}
    />
  );
}

/**
 * Rolagem inercial Lenis + GSAP ScrollTrigger. O Lenis é montado como irmão da árvore
 * (modo root, sem envolver o conteúdo): nenhum componente da página re-renderiza por causa dele.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LenisRoot />
    </>
  );
}
