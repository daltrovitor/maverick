// Hello World
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SCROLL_LOCK_EVENT, type ScrollLockDetail } from "@/lib/scrollLock";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const HEADER_OFFSET = -76;

/**
 * Vive dentro do contexto do Lenis: o hook `useLenis` só recebe a instância depois que o
 * ReactLenis a cria (num efeito), então tudo que depende dela fica aqui.
 */
function LenisBridge() {
  const lenis = useLenis(ScrollTrigger.update);

  useEffect(() => {
    if (!lenis) return;

    // Intro em tela cheia (ou outros overlays) podem travar/destravar a rolagem.
    const onLock = (event: Event) => {
      const { locked } = (event as CustomEvent<ScrollLockDetail>).detail;
      if (locked) lenis.stop();
      else lenis.start();
    };
    window.addEventListener(SCROLL_LOCK_EVENT, onLock);
    if (document.documentElement.hasAttribute("data-scroll-locked")) lenis.stop();

    return () => window.removeEventListener(SCROLL_LOCK_EVENT, onLock);
  }, [lenis]);

  return null;
}

/**
 * Rolagem inercial Lenis sincronizada ao GSAP: um único loop RAF (gsap.ticker) move o Lenis,
 * e cada evento de scroll do Lenis atualiza o ScrollTrigger. O Lenis é montado como irmão da
 * árvore (modo root), então nenhum componente da página re-renderiza por causa dele.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  // Com movimento reduzido a roda do mouse rola de forma nativa (o Lenis é recriado ao mudar).
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  useEffect(() => {
    // Lê a instância a cada frame: ela só existe depois do efeito interno do ReactLenis.
    const tick = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <>
      {children}
      <ReactLenis
        root
        ref={lenisRef}
        options={{
          lerp: 0.08,
          duration: 1.2,
          autoRaf: false,
          smoothWheel: !reducedMotion,
          anchors: { offset: HEADER_OFFSET },
        }}
      >
        <LenisBridge />
      </ReactLenis>
    </>
  );
}
