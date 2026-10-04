// Hello World
import { CheckoutDemo } from "@/components/commerce/CheckoutDemo";
import { DemoCard } from "@/components/commerce/DemoCard";
import { FreightDemo } from "@/components/commerce/FreightDemo";
import { LifestyleBanners } from "@/components/commerce/LifestyleBanners";
import { OrdersDemo } from "@/components/commerce/OrdersDemo";
import { StorefrontDemo } from "@/components/commerce/StorefrontDemo";
import { Reveal } from "@/components/ui/Reveal";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { COMMERCE_FEATURES } from "@/lib/content";

export function Commerce() {
  return (
    <section id="ecommerce" aria-labelledby="ecommerce-title" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="ecommerce-title"
          index="03 / 07"
          meta="Plataforma de alta conversão"
          title="Uma loja que vende sozinha, 24 horas por dia."
          emphasis={["sozinha,"]}
        >
          <p>
            O fim do “chama na DM”: checkout transparente, pedidos em tempo real, frete automático e vitrines que criam desejo.
            Tudo abaixo é interativo — é exatamente o que o cliente da Maverick vai usar.
          </p>
        </SectionIntro>

        <Reveal as="ol" className="mt-14 grid grid-cols-1 border-t border-line-strong sm:grid-cols-2 lg:grid-cols-5">
          {COMMERCE_FEATURES.map((feature, index) => (
            <li
              key={feature.id}
              data-reveal
              className="border-b border-line py-5 sm:pr-6 lg:border-b-0 lg:border-r lg:px-5 lg:first:pl-0 lg:last:border-r-0"
            >
              <span className="tabular font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-2 font-serif text-xl leading-tight text-ink">{feature.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
            </li>
          ))}
        </Reveal>

        <div className="mt-12 flex flex-col gap-6">
          <LifestyleBanners />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <DemoCard
              className="lg:col-span-7"
              index="04"
              title="Vitrines por categoria"
              description="Trucker Premium, Snapback Clássico e drops limitados com cronômetro."
            >
              <StorefrontDemo />
            </DemoCard>
            <DemoCard
              className="lg:col-span-5"
              index="01"
              title="Checkout transparente"
              description="Pix com confirmação em tempo real ou cartão em 1 clique."
            >
              <CheckoutDemo />
            </DemoCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <DemoCard
              className="lg:col-span-5"
              index="03"
              title="Frete automático por CEP"
              description="Melhor Envio: Correios PAC, SEDEX e Jadlog com prazo e valor."
            >
              <FreightDemo />
            </DemoCard>
            <DemoCard
              className="lg:col-span-7"
              index="02"
              title="Painel de pedidos em tempo real"
              description="Alerta no WhatsApp e status Separando → Enviado → Entregue."
            >
              <OrdersDemo />
            </DemoCard>
          </div>
        </div>
      </div>
    </section>
  );
}
