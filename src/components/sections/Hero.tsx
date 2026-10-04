// Hello World
import { ArrowDownRight } from "lucide-react";
import { AllianceMark } from "@/components/sections/AllianceMark";
import { MagneticLink } from "@/components/ui/MagneticLink";
import { HERO_FACTS } from "@/lib/content";

export function Hero() {
  return (
    <section id="alianca" aria-labelledby="hero-title" className="relative overflow-x-clip">
      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-10 lg:pb-24 lg:pt-20">
        <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-12 lg:gap-x-8">
          <div className="lg:col-span-8">
            <h1
              id="hero-title"
              className="font-serif text-[2.45rem] leading-[1.02] tracking-[-0.02em] text-ink sm:text-6xl lg:text-[4.6rem] xl:text-[5.1rem]"
            >
              Do Conceito ao Domínio do Mercado:{" "}
              <span className="italic text-ink-soft">A Infraestrutura Digital Definitiva para a Maverick.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg lg:ml-[16.6%]">
              Como a ViraWeb transformará a Maverick em uma das maiores marcas de headwear &amp; lifestyle do Brasil, unindo
              engenharia de software de ponta, produto 3D interativo e máquina de crescimento orgânico.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-[16.6%]">
              <MagneticLink
                href="#produto-3d"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-espresso"
              >
                Explorar o boné em 3D
                <ArrowDownRight className="size-4" aria-hidden="true" />
              </MagneticLink>
              <a
                href="#proposta"
                className="inline-flex min-h-12 items-center justify-center rounded-sm border border-line-strong px-6 text-sm font-medium text-ink transition-colors hover:border-ink"
              >
                Simular o acordo de 25%
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm lg:col-span-4 lg:col-start-9 lg:max-w-none lg:self-end">
            <AllianceMark />
          </div>
        </div>

        <dl className="mt-16 grid grid-cols-1 border-t border-line sm:grid-cols-3 lg:mt-20">
          {HERO_FACTS.map((fact, index) => (
            <div
              key={fact.label}
              className={`py-5 sm:px-5 ${index > 0 ? "border-t border-line sm:border-l sm:border-t-0" : "sm:pl-0"}`}
            >
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{fact.label}</dt>
              <dd className="mt-2 font-serif text-2xl leading-tight text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
