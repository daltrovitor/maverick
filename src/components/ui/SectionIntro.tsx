// Hello World
import type { ReactNode } from "react";
import { KineticHeading } from "@/components/ui/KineticHeading";

interface SectionIntroProps {
  readonly id: string;
  readonly index: string;
  readonly title: string;
  readonly emphasis?: readonly string[];
  readonly meta: string;
  readonly children?: ReactNode;
}

/**
 * Cabeçalho editorial assimétrico: título monumental em 8 colunas,
 * micro-metadado técnico na margem direita e texto de apoio recuado.
 */
export function SectionIntro({ id, index, title, emphasis, meta, children }: SectionIntroProps) {
  return (
    <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-12 lg:gap-x-8">
      <KineticHeading
        id={id}
        text={title}
        emphasis={emphasis}
        className="font-serif text-[2.35rem] leading-[1.02] tracking-[-0.015em] text-ink sm:text-5xl lg:col-span-8 lg:text-[4.25rem]"
      />
      <p className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted lg:col-span-3 lg:col-start-10 lg:flex-col lg:items-end lg:justify-end lg:gap-1 lg:pb-3 lg:text-right">
        <span className="tabular text-ink">{index}</span>
        <span>{meta}</span>
      </p>
      {children ? (
        <div className="max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg lg:col-span-6 lg:col-start-2">{children}</div>
      ) : null}
    </div>
  );
}
