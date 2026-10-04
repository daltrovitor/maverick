// Hello World
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AnimatedMaverickMark, AnimatedViraWebMark } from "@/components/brand/AnimatedMarks";
import { setScrollLocked } from "@/lib/scrollLock";

export const INTRO_REPLAY_EVENT = "maverick:replay-intro";
const STORAGE_KEY = "viraweb_maverick_intro_seen";

/** Dispara o replay da animação de abertura de qualquer botão da página. */
export function replayPartnershipIntro(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INTRO_REPLAY_EVENT));
  }
}

/**
 * Animação cinematográfica de abertura (estilo gs.prx.app.br):
 * Tela cheia, montagem progressiva dos logos da parceria, citação estratégica,
 * controle por Esc/Espaço e integração com trava/destrava da rolagem inercial (Lenis).
 */
export function PartnershipIntro() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [stage, setStage] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const closeIntro = useCallback(() => {
    clearTimers();
    setIsExiting(true);
    setScrollLocked(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Navegação privada sem sessionStorage
    }
    const exitTimer = window.setTimeout(() => {
      setIsOpen(false);
      setIsExiting(false);
      setStage(0);
    }, 650);
    timersRef.current.push(exitTimer);
  }, [clearTimers]);

  const startAnimation = useCallback(() => {
    clearTimers();
    setIsOpen(true);
    setIsExiting(false);
    setStage(0);
    setReplayKey((k) => k + 1);
    setScrollLocked(true);

    // Etapa 1: Título e cabeçalho entram (~120ms)
    const t1 = window.setTimeout(() => setStage(1), 120);
    // Etapa 2: Emblemas vetoriais entram e se montam (~650ms)
    const t2 = window.setTimeout(() => setStage(2), 650);
    // Etapa 3: Citação estratégica e badges de equity (~2200ms)
    const t3 = window.setTimeout(() => setStage(3), 2200);
    // Auto-encerramento aos 6.2s caso o usuário não pule
    const t4 = window.setTimeout(() => closeIntro(), 6200);

    timersRef.current.push(t1, t2, t3, t4);
  }, [clearTimers, closeIntro]);

  // Checagem de primeira visita (ou hash de navegação direta)
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      seen = false;
    }

    const hasDirectHash = Boolean(window.location.hash);
    if (!seen && !reducedMotion && !hasDirectHash) {
      startAnimation();
    }

    const onReplay = () => startAnimation();
    window.addEventListener(INTRO_REPLAY_EVENT, onReplay);

    return () => {
      clearTimers();
      window.removeEventListener(INTRO_REPLAY_EVENT, onReplay);
    };
  }, [clearTimers, startAnimation]);

  // Teclado: Esc ou Espaço pula a intro
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === " " || event.code === "Space") {
        event.preventDefault();
        closeIntro();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeIntro]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação da Proposta de Parceria Estratégica ViraWeb × Maverick"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#08080c] p-4 text-white select-none sm:p-6 transition-all duration-700 ease-out ${
        isExiting ? "pointer-events-none opacity-0 scale-[1.02]" : "opacity-100 scale-100"
      }`}
    >
      {/* Luz ambiente radial: cobalto ViraWeb + ouro champanhe Maverick */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(41,101,174,0.18)_0%,rgba(212,175,55,0.10)_35%,rgba(8,8,12,0.95)_70%)]"
        aria-hidden="true"
      />

      {/* Botão de Pular */}
      <div className="absolute top-5 right-5 sm:top-8 sm:right-8 z-20">
        <button
          type="button"
          onClick={closeIntro}
          aria-label="Pular introdução da proposta"
          className="group inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <span>Pular introdução</span>
          <ArrowRight className="size-3.5 text-[#f2bf12] transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center justify-center px-4 text-center">
        {/* Bloco 1: Título e Cabeçalho */}
        <div
          className={`transition-all duration-700 ease-out ${
            stage >= 1 ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          }`}
        >
          <p className="font-mono text-xs sm:text-sm font-semibold tracking-[0.32em] uppercase text-slate-400">
            PROPOSTA DE PARCERIA ESTRATÉGICA
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-transparent bg-gradient-to-r from-white via-[#faf6f0] to-[#f2bf12] bg-clip-text sm:text-5xl md:text-6xl">
            VIRAWEB × MAVERICK
          </h2>
          <p className="mt-1 font-mono text-xs sm:text-sm tracking-widest text-[#f2bf12] uppercase">
            DO CONCEITO AO DOMÍNIO DO MERCADO
          </p>
        </div>

        {/* Bloco 2: Marcas Animadas Convergindo */}
        <div
          className={`mt-8 sm:mt-12 flex w-full flex-col items-center justify-center gap-6 sm:gap-10 md:flex-row md:gap-14 transition-all duration-700 ease-out ${
            stage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {/* Lado ViraWeb */}
          <div className="flex max-w-[260px] flex-col items-center justify-center">
            <div className="w-24 sm:w-32 md:w-36 filter drop-shadow-[0_4px_24px_rgba(41,101,174,0.45)]">
              <AnimatedViraWebMark key={`intro-vw-${replayKey}`} title="Emblema ViraWeb" className="h-auto w-full" />
            </div>
            <div className="mt-2 flex items-center font-sans text-xl sm:text-2xl text-white">
              <span className="font-bold">Vira</span>
              <span className="font-light text-slate-300">Web</span>
            </div>
            <span className="mt-1 font-mono text-[10px] tracking-widest text-[#3aa7d4] uppercase">
              Engenharia de Software &amp; IA
            </span>
          </div>

          {/* Divisor × */}
          <div className="flex items-center justify-center">
            <span className="font-mono text-2xl sm:text-4xl font-light text-slate-600">×</span>
          </div>

          {/* Lado Maverick */}
          <div className="flex max-w-[260px] flex-col items-center justify-center">
            <div className="w-24 sm:w-32 md:w-36 filter drop-shadow-[0_4px_24px_rgba(212,175,55,0.4)]">
              <AnimatedMaverickMark
                key={`intro-mv-${replayKey}`}
                title="Monograma Maverick"
                color="#ffffff"
                background="#08080c"
                className="h-auto w-full"
              />
            </div>
            <div className="mt-2 font-display text-xl sm:text-2xl tracking-[0.22em] text-white">
              MAVERICK
            </div>
            <span className="mt-1 font-mono text-[10px] tracking-widest text-[#f2bf12] uppercase">
              Headwear &amp; Lifestyle
            </span>
          </div>
        </div>

        {/* Bloco 3: Citação Estratégica e Badges */}
        <div
          className={`mt-8 sm:mt-12 flex flex-col items-center justify-center gap-3 transition-all duration-700 ease-out ${
            stage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="max-w-2xl text-base sm:text-lg md:text-xl font-medium leading-relaxed text-slate-200 italic">
            “Uma infraestrutura digital proprietária para transformar a Maverick na maior marca de headwear do Brasil.”
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
            <span className="font-mono text-xs font-semibold tracking-widest text-[#3aa7d4] uppercase">
              VENTURE PARTNER
            </span>
            <span className="hidden size-1.5 rounded-full bg-slate-600 sm:inline-block" aria-hidden="true" />
            <span className="rounded-full border border-[#f2bf12]/40 bg-[#f2bf12]/15 px-3 py-0.5 font-mono text-xs font-semibold text-[#f2bf12]">
              25% EQUITY + 25% LUCROS
            </span>
            <span className="hidden size-1.5 rounded-full bg-slate-600 sm:inline-block" aria-hidden="true" />
            <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-0.5 font-mono text-xs font-semibold text-blue-200">
              2026
            </span>
          </div>
        </div>
      </div>

      {/* Dica de teclado */}
      <div className="absolute bottom-5 sm:bottom-8 z-10 text-center">
        <p className="font-sans text-[11px] sm:text-xs text-slate-500 tracking-wide">
          Pressione{" "}
          <kbd className="rounded-xs border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            Esc
          </kbd>{" "}
          ou{" "}
          <kbd className="rounded-xs border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
            Espaço
          </kbd>{" "}
          para pular
        </p>
      </div>
    </div>
  );
}
