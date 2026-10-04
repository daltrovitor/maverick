// Hello World
"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

interface PointerParallaxProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Parallax de profundidade ao cursor: desloca filhos `.parallax-layer[data-depth]`
 * via transform (GPU), com suavização por transição CSS. Ignora toque e movimento reduzido.
 */
export function PointerParallax({ children, className }: PointerParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  // Libera as animações das marcas somente depois da primeira pintura com conteúdo (FCP) e do load:
  // animações rodando durante a 1ª pintura disputam o rasterizador e atrasam o FCP/LCP no mobile.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    let fallback: number | null = null;
    let observer: PerformanceObserver | null = null;
    let painted = false;
    let loaded = document.readyState === "complete";

    const play = () => {
      if (cancelled || !painted || !loaded) return;
      requestAnimationFrame(() => requestAnimationFrame(() => root.setAttribute("data-play", "")));
    };
    const onPaint = () => {
      painted = true;
      play();
    };
    const onLoad = () => {
      loaded = true;
      play();
    };

    if (!loaded) window.addEventListener("load", onLoad, { once: true });
    try {
      observer = new PerformanceObserver((list) => {
        if (list.getEntriesByName("first-contentful-paint").length > 0) onPaint();
      });
      observer.observe({ type: "paint", buffered: true });
    } catch {
      painted = true;
    }
    // Navegadores sem Paint Timing: libera após um intervalo seguro.
    fallback = window.setTimeout(() => {
      painted = true;
      loaded = true;
      play();
    }, 2500);
    play();

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("load", onLoad);
      if (fallback !== null) window.clearTimeout(fallback);
    };
  }, []);

  const apply = (x: number, y: number) => {
    const root = ref.current;
    if (!root) return;
    for (const layer of root.querySelectorAll<HTMLElement>(".parallax-layer[data-depth]")) {
      const depth = Number(layer.dataset.depth ?? 0);
      layer.style.transform = `translate3d(${(x * depth).toFixed(2)}px, ${(y * depth).toFixed(2)}px, 0)`;
    }
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => apply(x, y));
  };

  return (
    <div ref={ref} className={`alliance ${className ?? ""}`} onPointerMove={handleMove} onPointerLeave={() => apply(0, 0)}>
      {children}
    </div>
  );
}
