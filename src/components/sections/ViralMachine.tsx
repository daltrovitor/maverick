// Hello World
import { ScriptStoryboard } from "@/components/sections/ScriptStoryboard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { VIRAL_FORMATS } from "@/lib/content";

export function ViralMachine() {
  return (
    <section id="conteudo" aria-labelledby="conteudo-title" className="border-t border-line bg-white">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="conteudo-title"
          index="06 / 07"
          meta="Tráfego orgânico · Reels & TikTok"
          title="Roteiros validados para milhões de visualizações gratuitas."
          emphasis={["gratuitas."]}
        >
          <p>
            A ViraWeb estrutura o plano tático de conteúdo junto com a loja: ganchos de 3 segundos, retenção por prova visual e
            chamada direta para o link da bio, onde o checkout converte.
          </p>
        </SectionIntro>

        <div className="mt-14">
          <ScriptStoryboard />
        </div>

        <Reveal className="mt-20">
          <h3 data-reveal className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
            Cinco formatos de vídeo para o calendário editorial
          </h3>

          {/* Estrutura única: cartões empilhados no mobile, grade tabular de 5 colunas no desktop */}
          <div className="mt-8 border-t border-line-strong">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[1.25fr_1fr_1fr_1fr_0.8fr] gap-6 border-b border-line py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted lg:grid"
            >
              <span>Formato</span>
              <span>Gancho visual (0–3 s)</span>
              <span>Retenção (3–18 s)</span>
              <span>Chamada para ação</span>
              <span>Áudio</span>
            </div>
            <ol>
              {VIRAL_FORMATS.map((row, index) => (
                <li
                  key={row.format}
                  data-reveal
                  className="grid grid-cols-1 gap-4 border-b border-line py-6 lg:grid-cols-[1.25fr_1fr_1fr_1fr_0.8fr] lg:gap-6 lg:py-5"
                >
                  <h4 className="font-serif text-2xl leading-tight text-ink lg:text-xl">
                    <span className="tabular mr-2 font-mono text-[11px] text-muted">{index + 1}</span>
                    {row.format}
                  </h4>
                  {[
                    { label: "Gancho (0–3 s)", value: row.hook, strong: false },
                    { label: "Retenção (3–18 s)", value: row.retention, strong: false },
                    { label: "Chamada para ação", value: row.cta, strong: true },
                    { label: "Áudio", value: row.audio, strong: false },
                  ].map((cell) => (
                    <p key={cell.label} className="text-sm leading-relaxed">
                      <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted lg:sr-only">
                        {cell.label}
                      </span>
                      <span className={cell.strong ? "text-ink" : "text-ink-soft"}>{cell.value}</span>
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
