// Hello World
import { DealInteractive } from "@/components/sections/DealInteractive";
import { Reveal } from "@/components/ui/Reveal";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { DEAL_REASONS, ROADMAP, VIRAWEB_CONTRIBUTIONS } from "@/lib/content";

export function Deal() {
  return (
    <section id="proposta" aria-labelledby="proposta-title" className="border-t border-line bg-cream">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="proposta-title"
          index="07 / 07"
          meta="Tech Partner & Venture Studio"
          title="O acordo: zero custo de software, sociedade de 25%."
          emphasis={["25%."]}
        >
          <p>
            A ViraWeb entra como sócia de tecnologia. Em vez de cobrar pelo projeto, aporta a plataforma inteira e o trabalho
            contínuo de crescimento, e é remunerada pelo resultado que ajuda a construir.
          </p>
        </SectionIntro>

        {/* A oferta em três colunas */}
        <Reveal className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line lg:grid-cols-3">
          <div data-reveal className="flex flex-col gap-4 bg-white p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Investimento da Maverick</p>
            <p className="tabular text-5xl font-semibold tracking-tight text-ink">R$ 0,00</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Nenhum custo inicial de desenvolvimento da plataforma. A Maverick segue focada em produto, marca e comunidade.
            </p>
          </div>
          <div data-reveal className="flex flex-col gap-4 bg-white p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Aporte da ViraWeb</p>
            <ul className="flex flex-col gap-2.5 text-[15px] leading-snug text-ink">
              {VIRAWEB_CONTRIBUTIONS.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2.5 h-px w-3 shrink-0 bg-cobalt" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="flex flex-col gap-4 bg-white p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Contrapartida</p>
            <div className="flex items-baseline gap-6">
              <p className="flex flex-col">
                <span className="tabular text-5xl font-semibold tracking-tight text-ink">25%</span>
                <span className="text-sm text-ink-soft">dos lucros líquidos</span>
              </p>
              <p className="flex flex-col">
                <span className="tabular text-5xl font-semibold tracking-tight text-ink">25%</span>
                <span className="text-sm text-ink-soft">de equity</span>
              </p>
            </div>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Participação societária na Maverick, formalizada em contrato com cláusulas de proteção mútua.
            </p>
          </div>
        </Reveal>

        {/* Por que faz sentido */}
        <Reveal as="ol" className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-x-8">
          {DEAL_REASONS.map((reason, index) => (
            <li key={reason.title} data-reveal className="border-t border-line-strong pt-5">
              <span className="tabular font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-serif text-2xl leading-tight text-ink">{reason.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{reason.body}</p>
            </li>
          ))}
        </Reveal>

        <div className="mt-20">
          <h3 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">Simulador de resultados da sociedade</h3>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            Arraste para simular o volume mensal de pedidos e veja faturamento, margem, a divisão 75% / 25% e o valuation da
            marca em 12 meses.
          </p>
          <div className="mt-8">
            <DealInteractive />
          </div>
        </div>

        {/* Cronograma */}
        <div className="mt-20">
          <h3 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">Do aceite à loja no ar</h3>
          <Reveal as="ol" className="mt-8 grid grid-cols-1 border-t border-line-strong sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((step) => (
              <li key={step.title} data-reveal className="border-b border-line py-6 sm:pr-6 lg:border-b-0 lg:border-r lg:px-5 lg:first:pl-0 lg:last:border-r-0">
                <p className="tabular font-mono text-[11px] uppercase tracking-[0.12em] text-champagne-ink">{step.window}</p>
                <p className="mt-2 font-serif text-xl leading-tight text-ink">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
