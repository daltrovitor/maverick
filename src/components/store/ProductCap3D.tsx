// Hello World
"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ProductCapStage } from "@/components/cap/ProductCapStage";

type Status = "loading" | "ready" | "error";

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    // Libera o contexto de teste na hora (o navegador limita quantos ficam abertos).
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Boné do produto em 3D, pintado a partir da foto (cores e logo lidos automaticamente; ver
 * components/cap/productCapLook.ts). O three.js e o modelo só são baixados quando o cliente abre
 * esta vista. Arrastar gira; setas do teclado também.
 */
export function ProductCap3D({ imageUrl, productName }: { readonly imageUrl: string | null; readonly productName: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<ProductCapStage | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [stageReady, setStageReady] = useState(false);
  const [touched, setTouched] = useState(false);
  const hintId = useId();

  // Monta a cena uma vez; a foto é aplicada no efeito seguinte (e reaplicada ao trocar a cor).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let disposed = false;
    let stage: ProductCapStage | null = null;
    let resize: ResizeObserver | null = null;
    let visible: IntersectionObserver | null = null;

    if (!supportsWebGL()) {
      queueMicrotask(() => setStatus("error"));
      return;
    }

    void (async () => {
      try {
        const { ProductCapStage } = await import("@/components/cap/ProductCapStage");
        if (disposed) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const low = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
        stage = new ProductCapStage({
          canvas,
          reducedMotion,
          quality: low ? "low" : "high",
          onInteract: () => setTouched(true),
          onContextLost: () => setStatus("error"),
        });
        await stage.load();
        if (disposed) {
          stage.dispose();
          return;
        }
        stageRef.current = stage;
        const rect = wrap.getBoundingClientRect();
        stage.resize(rect.width, rect.height);
        resize = new ResizeObserver(([entry]) => {
          if (entry) stage?.resize(entry.contentRect.width, entry.contentRect.height);
        });
        resize.observe(wrap);
        visible = new IntersectionObserver(([entry]) => stage?.setActive(Boolean(entry?.isIntersecting)));
        visible.observe(wrap);
        setStageReady(true);
      } catch (err) {
        console.error("[3d] cena do produto", err);
        if (!disposed) setStatus("error");
      }
    })();

    return () => {
      disposed = true;
      resize?.disconnect();
      visible?.disconnect();
      stageRef.current = null;
      stage?.dispose();
    };
  }, []);

  // Foto → cores e logo (de novo a cada troca de cor do produto).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stageReady || !stage) return;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const { readCapLook } = await import("@/components/cap/productCapTexture");
        const look = imageUrl ? await readCapLook(imageUrl, controller.signal).catch(() => null) : null;
        if (cancelled) return;
        stage.setLook(look);
        await stage.warmUp();
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("[3d] textura do produto", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [imageUrl, stageReady]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={`${productName} em 3D`}
        aria-describedby={hintId}
        className={`h-full w-full cursor-grab touch-pan-y outline-offset-[-2px] transition-opacity duration-700 active:cursor-grabbing ${
          status === "ready" ? "opacity-100" : "opacity-0"
        }`}
      />
      <p
        id={hintId}
        aria-live="polite"
        className={`type-micro pointer-events-none absolute inset-x-0 bottom-4 text-center text-muted transition-opacity duration-500 ${
          status === "ready" && touched ? "opacity-0" : "opacity-100"
        }`}
      >
        {status === "loading"
          ? "Montando o boné em 3D…"
          : status === "error"
            ? "Não foi possível abrir o 3D neste aparelho."
            : (
              <>
                Arraste para girar<span className="hidden sm:inline"> · prévia gerada a partir da foto</span>
              </>
            )}
      </p>
    </div>
  );
}
