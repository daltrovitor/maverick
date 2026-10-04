// Hello World
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

interface Banner {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly scene: ReactNode;
}

const INK = "#1f1612";
const LINE = "#d9cfc1";

/** Cena 1 — campo: horizonte, cerca em perspectiva e sol baixo (à direita, deixando respiro para o texto). */
const FieldScene = (
  <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden="true">
    <rect width="1200" height="500" fill="#efe6d6" />
    <circle cx="960" cy="236" r="64" fill="#e4d3b4" />
    <path d="M0 300 C200 280 400 290 600 284 C800 278 1000 290 1200 280 L1200 500 L0 500 Z" fill="#d9c8a8" />
    <path d="M0 340 C300 320 700 336 1200 318 L1200 500 L0 500 Z" fill="#c9b48f" />
    {Array.from({ length: 7 }, (_, i) => {
      const x = 640 + i * 62 + i * i * 4;
      const h = 34 + i * 16;
      return <rect key={i} x={x} y={352 - h * 0.4} width={3 + i * 0.9} height={h} fill={INK} opacity={0.72} />;
    })}
    <path d="M640 346 L1160 330 M640 358 L1160 350" stroke={INK} strokeWidth="2" opacity="0.55" />
  </svg>
);

/** Cena 2 — ferro: barra olímpica e anilhas em silhueta. */
const IronScene = (
  <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden="true">
    <rect width="1200" height="500" fill="#ece7df" />
    <rect x="0" y="380" width="1200" height="120" fill="#ddd4c7" />
    <rect x="600" y="248" width="560" height="9" fill={INK} />
    {[640, 668, 692].map((x, i) => (
      <rect key={`l${x}`} x={x} y={252 - (100 - i * 20)} width={20} height={(100 - i * 20) * 2} fill={INK} opacity={0.88 - i * 0.12} />
    ))}
    {[1100, 1072, 1048].map((x, i) => (
      <rect key={`r${x}`} x={x} y={252 - (100 - i * 20)} width={20} height={(100 - i * 20) * 2} fill={INK} opacity={0.88 - i * 0.12} />
    ))}
    <rect x="820" y="380" width="120" height="4" fill={LINE} />
  </svg>
);

/** Cena 3 — estrada: perspectiva central com ponto de fuga. */
const RoadScene = (
  <svg viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" className="size-full" aria-hidden="true">
    <rect width="1200" height="500" fill="#f1ebe1" />
    <rect y="250" width="1200" height="250" fill="#ddd0bb" />
    <path d="M840 250 L900 250 L1200 470 L1200 500 L560 500 Z" fill="#bfae92" />
    {[0, 1, 2, 3, 4].map((i) => {
      const t = i / 5;
      const y = 262 + t * t * 230;
      const h = 6 + t * 26;
      const w = 2 + t * 8;
      const x = 870 + t * t * 60;
      return <rect key={i} x={x - w / 2} y={y} width={w} height={h} fill="#f1ebe1" />;
    })}
    <path d="M0 250 L1200 250" stroke={INK} strokeWidth="1.5" opacity="0.5" />
    <path d="M870 250 L420 500 M870 250 L1200 380" stroke={INK} strokeWidth="1" opacity="0.18" />
  </svg>
);

const BANNERS: readonly Banner[] = [
  { id: "campo", kicker: "Coleção Campo", title: "Feito para a lida, do nascer do sol ao último lote.", scene: FieldScene },
  { id: "ferro", kicker: "Maverick Gym", title: "Da terra ao ferro, o mesmo padrão.", scene: IronScene },
  { id: "estrada", kicker: "Drop 002", title: "Estilo que aguenta a estrada inteira.", scene: RoadScene },
];

const INTERVAL_MS = 6000;

export function LifestyleBanners() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const banner = BANNERS[index] ?? BANNERS[0]!;

  const go = useCallback((delta: number) => {
    setIndex((current) => (current + delta + BANNERS.length) % BANNERS.length);
  }, []);

  useEffect(() => {
    if (reduce || !playing || hovered) return;
    const timer = window.setTimeout(() => go(1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, playing, hovered, reduce, go]);

  const autoplay = playing && !reduce;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Banners institucionais do lifestyle Maverick"
      className="relative overflow-hidden rounded-sm border border-line"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <div className="relative aspect-[4/5] w-full min-[480px]:aspect-[16/9] lg:aspect-[21/8]">
        <AnimatePresence initial={false}>
          <m.div
            key={banner.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.8 }, scale: { duration: 6, ease: "linear" } }}
          >
            {banner.scene}
          </m.div>
        </AnimatePresence>

        <div
          className="absolute inset-x-0 bottom-0 flex flex-col gap-4 bg-cream/95 p-5 sm:p-8 lg:max-w-[52%] lg:bg-transparent"
          aria-live={autoplay ? "off" : "polite"}
          aria-atomic="true"
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={banner.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="flex flex-col gap-2"
            >
              <p className="w-fit bg-white/85 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
                {banner.kicker}
              </p>
              <p className="max-w-xl font-serif text-3xl leading-[1.05] text-ink sm:text-4xl lg:text-5xl">{banner.title}</p>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-white px-2 sm:px-3">
        <div className="flex items-center">
          {BANNERS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ir para o banner ${i + 1}: ${item.kicker}`}
              aria-current={i === index ? "true" : undefined}
              className="flex size-12 items-center justify-center"
            >
              <span className={`h-0.5 w-6 transition-colors ${i === index ? "bg-ink" : "bg-line-strong"}`} />
            </button>
          ))}
        </div>
        <div className="flex items-center">
          {!reduce && (
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pausar banners" : "Reproduzir banners"}
              className="flex size-12 items-center justify-center text-ink"
            >
              {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            </button>
          )}
          <button type="button" onClick={() => go(-1)} aria-label="Banner anterior" className="flex size-12 items-center justify-center text-ink">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Próximo banner" className="flex size-12 items-center justify-center text-ink">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
