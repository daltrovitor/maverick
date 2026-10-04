// Hello World
import { Reveal } from "@/components/ui/Reveal";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { DIAGNOSIS } from "@/lib/content";

export function Diagnosis() {
  return (
    <section id="diagnostico" aria-labelledby="diagnostico-title" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="diagnostico-title"
          index="01 / 07"
          meta="Diagnóstico estratégico"
          title="Onde a Maverick está hoje e o que trava a escala."
          emphasis={["escala"]}
        >
          <p>
            A marca já tem o que é mais difícil de construir: identidade madura, arquétipo forte e um público do agro moderno,
            do esporte equestre e da academia que valoriza durabilidade. O que falta é a infraestrutura que transforma desejo em
            venda sem depender de mensagens manuais.
          </p>
        </SectionIntro>

        <Reveal as="ol" className="mt-16 border-t border-line-strong">
          {DIAGNOSIS.map((item, index) => (
            <li
              key={item.id}
              data-reveal
              className="grid grid-cols-1 gap-4 border-b border-line py-8 lg:grid-cols-12 lg:gap-x-8 lg:py-10"
            >
              <span className="tabular font-mono text-xs text-muted lg:col-span-1">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="font-serif text-2xl leading-tight text-ink lg:col-span-4 lg:text-3xl">{item.problem}</h3>
              <p className="text-[15px] leading-relaxed text-ink-soft lg:col-span-4">{item.detail}</p>
              <p className="border-l-2 border-champagne pl-4 text-[15px] font-medium leading-relaxed text-ink lg:col-span-3">
                {item.answer}
              </p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
