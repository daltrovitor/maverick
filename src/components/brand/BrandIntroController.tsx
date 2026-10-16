// Hello World
"use client";

import { useEffect, useRef } from "react";
import { INTRO_EXIT_EVENT, runIntroHold } from "@/components/brand/introGate";

/** Pausa mínima com o logo montado antes de sair… */
const HOLD_MS = 520;
/** …e o máximo que ela espera a cena 3D ficar pronta por trás (nada se move, a GPU trabalha à vontade). */
const HOLD_MAX_MS = 1600;
/** Teto para a montagem: numa aba em segundo plano as animações não concluem. */
const ASSEMBLY_MAX_MS = 6000;
const FAILSAFE_ANIMATION = "brand-intro-failsafe";
const SCROLL_KEYS = new Set([" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"]);

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
 * Saída da abertura da marca. A montagem em CSS sempre toca inteira (rolar não a interrompe);
 * com o logo montado ela segura um instante — enquanto a cena 3D se prepara por trás — e leva o
 * monograma até o lugar dele no cabeçalho, com o fundo branco se dissolvendo. Durante a pausa,
 * qualquer gesto (clique, tecla, rolagem) adianta a saída; "Pular abertura" e Esc pulam a
 * qualquer momento.
 */
export function BrandIntroController() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.clearTimeout(pendingFinish);
    const root = document.documentElement;
    const button = buttonRef.current;
    const overlay = button?.closest<HTMLElement>("[data-brand-intro]");
    if (!button || !overlay || root.dataset.intro !== "playing") return;

    let phase: "assembling" | "holding" | "leaving" | "done" = "assembling";
    let alive = true;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, ms)));

    const finish = () => {
      phase = "done";
      root.dataset.intro = "done";
    };

    const animations = overlay.getAnimations({ subtree: true });
    // O JavaScript chegou depois que a camada já se retirou sozinha: só devolve a página.
    const failsafe = animations.find((a) => a instanceof CSSAnimation && a.animationName === FAILSAFE_ANIMATION);
    if (failsafe?.playState === "finished") {
      finish();
      return;
    }

    const leave = () => {
      if (!alive || phase === "leaving" || phase === "done") return;
      const assembled = phase === "holding";
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
      onceTransitionEnd(mark, "transform", finish, 1600);
    };

    const settle = () => {
      if (!alive || phase !== "assembling") return;
      phase = "holding";
      void Promise.all([wait(HOLD_MS), Promise.race([runIntroHold(), wait(HOLD_MAX_MS)])]).then(leave);
    };

    // A roda e o toque não rolam a página por trás; na pausa final eles adiantam a saída.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (phase === "holding") leave();
    };
    const onTouchMove = () => {
      if (phase === "holding") leave();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (phase === "holding" && event.target !== button) leave();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || phase === "holding") {
        leave();
        return;
      }
      if (SCROLL_KEYS.has(event.key) && event.target === document.body) event.preventDefault();
    };
    button.addEventListener("click", leave);
    overlay.addEventListener("wheel", onWheel, { passive: false });
    overlay.addEventListener("touchmove", onTouchMove, { passive: true });
    overlay.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    const assembly = animations.filter((a) => a !== failsafe);
    Promise.all(assembly.map((a) => a.finished)).then(settle, () => {});
    timers.push(window.setTimeout(settle, ASSEMBLY_MAX_MS));

    return () => {
      alive = false;
      button.removeEventListener("click", leave);
      overlay.removeEventListener("wheel", onWheel);
      overlay.removeEventListener("touchmove", onTouchMove);
      overlay.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
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
