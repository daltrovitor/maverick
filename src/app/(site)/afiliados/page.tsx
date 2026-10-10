// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateForm } from "@/components/affiliates/AffiliateForm";

export const metadata: Metadata = {
  title: "Programa de afiliados",
  description:
    "Candidate-se ao programa de afiliados da Maverick Capshop: perfis com pelo menos 1.000 seguidores, análise individual e código exclusivo de 25%.",
  alternates: { canonical: "/afiliados" },
};

const STEPS = [
  {
    n: "01",
    title: "Candidatura",
    text: "Você conta quem é o seu público, como pretende divulgar e qual a sua previsão realista de vendas.",
  },
  {
    n: "02",
    title: "Análise individual",
    text: "Nossa equipe confere o perfil (mínimo de 1.000 seguidores) e pode pedir mais informações antes de decidir.",
  },
  {
    n: "03",
    title: "Código de 25%",
    text: "Aprovado, você recebe um código exclusivo de 25% válido por 24 horas para divulgar. Cada cliente usa uma vez e as vendas ficam atribuídas a você.",
  },
] as const;

export default function AffiliatesPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-10 pb-24 sm:px-8 sm:pt-16">
      <header className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <h1 className="type-monument text-[clamp(3.5rem,11vw,9.5rem)] lg:col-span-8">Afiliados</h1>
        <p className="max-w-md leading-relaxed text-ink-soft lg:col-span-4 lg:justify-self-end">
          Para criadores com audiência real. Poucas vagas, análise uma a uma, como a nossa curadoria.
        </p>
      </header>

      <ol className="mt-14 grid gap-px overflow-hidden rounded-xs border border-line bg-line md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="bg-paper p-6 sm:p-8">
            <span className="type-micro text-gold-ink">{step.n}</span>
            <h2 className="type-brand mt-4 text-xl">{step.title}</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-20 grid gap-14 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <h2 className="type-brand text-2xl">Antes de enviar</h2>
            <ul className="mt-6 grid gap-4 text-sm leading-relaxed text-ink-soft">
              <li>
                <strong className="text-ink">Uma candidatura por pessoa.</strong> A combinação de CPF e telefone só pode ser
                usada uma vez, inclusive após uma recusa.
              </li>
              <li>
                <strong className="text-ink">Sem aprovação automática.</strong> O número de seguidores informado é conferido
                no perfil público.
              </li>
              <li>
                <strong className="text-ink">Seus dados.</strong> Coletamos apenas o necessário para validar a identidade,
                evitar duplicidade e falar com você. Detalhes na{" "}
                <Link href="/politicas/privacidade" className="underline">
                  Política de Privacidade
                </Link>
                .
              </li>
              <li>
                <strong className="text-ink">Acompanhamento.</strong> Ao enviar, você recebe um link pessoal para acompanhar a
                análise. Guarde-o.
              </li>
            </ul>
          </div>
        </aside>
        <section className="lg:col-span-8" aria-labelledby="form-title">
          <h2 id="form-title" className="sr-only">
            Formulário de candidatura
          </h2>
          <AffiliateForm />
        </section>
      </div>
    </div>
  );
}
