// Hello World
"use client";

import { RotateCcw } from "lucide-react";
import { AnimatedMaverickMark, AnimatedViraWebMark } from "@/components/brand/AnimatedMarks";
import { replayPartnershipIntro } from "@/components/brand/PartnershipIntro";
import { PointerParallax } from "@/components/ui/PointerParallax";

const INK = "#1f1612";

/**
 * Composição de boas-vindas (Server Component): as marcas entram com animações CSS
 * dirigidas por uma curva de mola real, sem depender da hidratação para começar.
 */
export function AllianceMark() {
  return (
    <figure className="w-full">
      <PointerParallax className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-line bg-cream">
        <svg className="absolute inset-0 size-full" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="250" x2="400" y2="250" stroke="#ebe5dc" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="200" y1="0" x2="200" y2="500" stroke="#ebe5dc" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line
            className="mark-line"
            pathLength={1}
            x1="96"
            y1="150"
            x2="304"
            y2="350"
            stroke={INK}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="parallax-layer absolute left-[10%] top-[12%] w-[42%]" data-depth="-10">
          <div className="mark-slide-left">
            <AnimatedViraWebMark title="Emblema ViraWeb" className="h-auto w-full" />
          </div>
        </div>

        <span
          aria-hidden="true"
          className="mark-cross absolute left-[calc(50%-24px)] top-[calc(50%-24px)] flex size-12 items-center justify-center rounded-xs border border-line-strong bg-white font-mono text-base text-ink"
        >
          ×
        </span>

        <div className="parallax-layer absolute bottom-[12%] right-[8%] w-[46%]" data-depth="12">
          <div className="mark-slide-right">
            <AnimatedMaverickMark title="Monograma Maverick" className="h-auto w-full" />
          </div>
        </div>

        <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          ViraWeb · Engenharia
        </span>
        <span className="absolute bottom-4 right-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Maverick · Est. 2026
        </span>
      </PointerParallax>
      <div className="mt-3 flex items-center justify-between gap-2">
        <figcaption className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Engenharia de software × Headwear &amp; Lifestyle
        </figcaption>
        <button
          type="button"
          onClick={replayPartnershipIntro}
          aria-label="Rever a animação de abertura da proposta"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft hover:text-ink transition-colors cursor-pointer"
        >
          <RotateCcw className="size-3 text-[#b48328]" aria-hidden="true" />
          <span>Rever animação</span>
        </button>
      </div>
    </figure>
  );
}
