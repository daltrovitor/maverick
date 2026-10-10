// Hello World
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

/** Diferenciais reais da operação (nada aqui depende de promessa não implementada). */
const FACTS = [
  {
    n: "01",
    title: "Estoque real",
    text: "A disponibilidade de cada cor e tamanho é a do estoque da loja, reservada no momento do pedido.",
  },
  {
    n: "02",
    title: "Pix ou cartão",
    text: "Pix com QR Code e confirmação pela equipe, ou cartão de crédito em ambiente seguro do Stripe.",
  },
  {
    n: "03",
    title: "Frete pelo seu estado",
    text: "O valor aparece no checkout, antes de pagar, de acordo com o estado do endereço de entrega.",
  },
  {
    n: "04",
    title: "Pedido acompanhado",
    text: "Cada compra tem um link próprio com o status, do pagamento ao código de rastreio.",
  },
] as const;

export function Statement() {
  return (
    <section aria-labelledby="statement" className="bg-paper py-24 sm:py-32">
      <Reveal className="mx-auto grid max-w-[1440px] gap-10 px-4 sm:px-8 lg:grid-cols-12">
        <h2 id="statement" data-reveal className="type-monument text-[clamp(2.8rem,8vw,7rem)] text-ink lg:col-span-8">
          Antes de virar estilo, ele nasceu aqui.
        </h2>
        <p data-reveal className="max-w-md self-end leading-relaxed text-ink-soft lg:col-span-4 lg:justify-self-end">
          Curadoria em headwear: cada boné da loja é escolhido pela Maverick e vendido com o estoque que realmente
          existe.
        </p>
      </Reveal>
    </section>
  );
}

export function Facts() {
  return (
    <section aria-labelledby="fatos" className="border-t border-line bg-cream py-20 sm:py-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <h2 id="fatos" className="type-brand text-2xl sm:text-3xl">
          Como funciona a compra
        </h2>
        <Reveal as="ul" className="mt-12 grid gap-px overflow-hidden rounded-xs border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f) => (
            <li key={f.n} data-reveal className="bg-cream p-6 sm:p-8">
              <span className="type-micro text-gold-ink">{f.n}</span>
              <h3 className="mt-4 text-lg font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.text}</p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function AffiliateBand() {
  return (
    <section aria-labelledby="afiliados-cta" className="bg-paper py-20 sm:py-24">
      <Reveal className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div data-reveal>
          <h2 id="afiliados-cta" className="type-monument text-[clamp(2.4rem,6vw,5rem)]">
            Criador de conteúdo?
          </h2>
          <p className="mt-4 max-w-lg leading-relaxed text-ink-soft">
            O programa de afiliados é para perfis com audiência real (a partir de 1.000 seguidores). Aprovados recebem um
            código exclusivo de 25% válido por 24 horas para divulgar.
          </p>
        </div>
        <Link
          data-reveal
          href="/afiliados"
          className="type-micro inline-flex min-h-12 items-center self-start border-b border-ink pb-1 hover:text-gold-ink lg:self-end"
        >
          Quero me candidatar
        </Link>
      </Reveal>
    </section>
  );
}
