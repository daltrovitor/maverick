// Hello World
"use client";

import { useEffect, useRef } from "react";
import { INTRO_EXIT_EVENT } from "@/components/brand/introGate";

/** Pausa com o logo montado antes de sair. */
const HOLD_MS = 260;
/** Teto desde o início da navegação: se a aba ficou em segundo plano, sai assim mesmo. */
const MAX_WAIT_MS = 5200;
const FAILSAFE_ANIMATION = "brand-intro-failsafe";

/** Desmontagem real × ensaio do StrictMode: só encerra se nenhum efeito novo assumir. */
let pendingFinish: number | undefined;

function onceTransitionEnd(el: HTMLElement, property: string, done: () => void, fallbackMs: number) {
  let called = false;
  const finish = () => {
    if (called) return;
    called = true;
    el.removeEventListener("transitionend", onEnd);
    window.clearTimeout(timer);
    done();
  };
  const onEnd = (event: TransitionEvent) => {
    if (event.target === el && event.propertyName === property) finish();
  };
  el.addEventListener("transitionend", onEnd);
  const timer = window.setTimeout(finish, fallbackMs);
}

/**
 * Saída da abertura da marca. Espera a montagem em CSS terminar, segura um instante e leva o
 * monograma até o lugar dele no cabeçalho enquanto o fundo branco se dissolve. Qualquer gesto
 * (clique, tecla, rolagem) encurta: com o logo montado ele voa na hora; antes disso, a camada
 * some em fade rápido.
 */
export function BrandIntroController() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.clearTimeout(pendingFinish);
    const root = document.documentElement;
    const overlay = buttonRef.current?.closest<HTMLElement>("[data-brand-intro]");
    if (!overlay || root.dataset.intro !== "playing") return;

    let phase: "assembling" | "leaving" | "done" = "assembling";
    let assembled = false;
    const timers: number[] = [];

    const finish = () => {
      phase = "done";
      root.dataset.intro = "done";
    };

    const leave = () => {
      if (phase !== "assembling") return;
      phase = "leaving";
      root.dataset.intro = "leaving";
      window.dispatchEvent(new Event(INTRO_EXIT_EVENT));

      const mark = overlay.querySelector<HTMLElement>("[data-intro-mark]");
      const target = document.querySelector<HTMLElement>("header [data-brand-mark]");
      const to = target?.getBoundingClientRect();
      const from = mark?.getBoundingClientRect();
      const canFly =
        assembled && mark && to && from && from.width > 0 && to.width > 0 && to.bottom > 0 && to.top < window.innerHeight;
      if (!canFly) {
        overlay.classList.add("is-skipping");
        onceTransitionEnd(overlay, "opacity", finish, 700);
        return;
      }
      overlay.classList.add("is-leaving");
      mark.style.transform = `translate3d(${to.left - from.left}px, ${to.top - from.top}px, 0) scale(${to.width / from.width})`;
      onceTransitionEnd(mark, "transform", finish, 1500);
    };

    const onGesture = () => leave();
    overlay.addEventListener("pointerdown", onGesture);
    window.addEventListener("wheel", onGesture, { passive: true });
    window.addEventListener("touchmove", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);

    const settle = () => {
      assembled = true;
      timers.push(window.setTimeout(leave, HOLD_MS));
    };
    const assembly = overlay
      .getAnimations({ subtree: true })
      .filter((a) => !(a instanceof CSSAnimation && a.animationName === FAILSAFE_ANIMATION));
    Promise.all(assembly.map((a) => a.finished)).then(settle, () => {});
    timers.push(window.setTimeout(settle, Math.max(0, MAX_WAIT_MS - performance.now())));

    return () => {
      overlay.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("wheel", onGesture);
      window.removeEventListener("touchmove", onGesture);
      window.removeEventListener("keydown", onGesture);
      timers.forEach((t) => window.clearTimeout(t));
      // Saiu da página no meio da abertura: devolve o monograma ao cabeçalho.
      pendingFinish = window.setTimeout(() => {
        if (phase !== "done") finish();
      }, 0);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-intro-skip
      className="type-micro absolute right-2 bottom-2 inline-flex min-h-12 cursor-pointer items-center px-4 text-muted transition-colors hover:text-ink sm:right-6 sm:bottom-6"
    >
      Pular abertura
    </button>
  );
}
