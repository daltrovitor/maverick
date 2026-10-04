// Hello World
import { CreatorDashboard } from "@/components/sections/CreatorDashboard";
import { Reveal } from "@/components/ui/Reveal";
import { SectionIntro } from "@/components/ui/SectionIntro";

const MECHANISM = [
  {
    title: "Painel exclusivo do criador",
    body: "Cada parceiro acompanha cliques, vendas e saldo em tempo real, sem planilhas nem prints.",
  },
  {
    title: "Link rastreável + cupom próprio",
    body: "Atribuição precisa de cada venda, mesmo quando o seguidor compra dias depois.",
  },
  {
    title: "Comissão automática via Pix",
    body: "15% por boné vendido, calculados e pagos sem intervenção manual.",
  },
] as const;

const NETWORK = ["Laçadores e rodeio", "Atletas de crossfit", "Artistas sertanejos", "Criadores de lifestyle rural"] as const;

export function Affiliates() {
  return (
    <section id="afiliados" aria-labelledby="afiliados-title" className="border-t border-line bg-white">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="afiliados-title"
          index="04 / 07"
          meta="Creator Network · B2B2C"
          title="Uma rede de criadores vendendo Maverick todos os dias."
          emphasis={["criadores"]}
        >
          <p>
            Influenciadores rústicos, atletas e artistas viram uma força de vendas comissionada. A Maverick só paga quando vende,
            e cada parceiro tem um motivo real para divulgar a marca toda semana.
          </p>
        </SectionIntro>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-x-8">
          <Reveal className="flex flex-col lg:col-span-4">
            <ol className="border-t border-line-strong">
              {MECHANISM.map((item, index) => (
                <li key={item.title} data-reveal className="border-b border-line py-6">
                  <span className="tabular font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-serif text-2xl leading-tight text-ink">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{item.body}</p>
                </li>
              ))}
            </ol>
            <div data-reveal className="mt-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Perfis da rede</p>
              <ul className="mt-3 flex flex-col gap-1.5 text-[15px] text-ink">
                {NETWORK.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span aria-hidden="true" className="h-px w-5 bg-champagne" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <div className="lg:col-span-8">
            <CreatorDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}
