// Hello World
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { formatBRL } from "@/lib/br";
import { RollLink } from "@/components/ui/RollLink";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface LineupItem {
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  imageAlt: string;
}

/**
 * Transição da experiência para a compra: os modelos reais (em destaque no painel)
 * saem de uma pilha central e se abrem em arco conforme a rolagem; o CTA leva à /loja.
 * Sem produtos cadastrados, a seção mantém o convite sem inventar vitrine.
 */
export function ProductLineup({ items, instagramUrl }: { readonly items: LineupItem[]; readonly instagramUrl: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track || items.length === 0) return;
      const cards = Array.from(track.children) as HTMLElement[];
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const mid = (cards.length - 1) / 2;
        gsap.fromTo(
          cards,
          {
            xPercent: (i: number) => (mid - i) * 100,
            rotate: (i: number) => (mid - i) * 4,
            y: 60,
            autoAlpha: (i: number) => (i === Math.round(mid) ? 1 : 0.35),
          },
          {
            xPercent: 0,
            rotate: 0,
            y: (i: number) => Math.abs(i - mid) * 14,
            autoAlpha: 1,
            ease: "none",
            scrollTrigger: { trigger: sectionRef.current, start: "top 85%", end: "center 55%", scrub: 0.6 },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: sectionRef, dependencies: [items.length] },
  );

  return (
    <section ref={sectionRef} id="colecao" aria-labelledby="colecao-title" className="on-dark relative overflow-hidden bg-ink py-24 text-cream sm:py-32">
      {/* Pesponto: motivo da aba usado como fio condutor entre a experiência e a loja */}
      <div aria-hidden="true" className="stitch-x absolute inset-x-0 top-6 text-gold/50" />
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="colecao-title" className="type-monument text-[clamp(3rem,10vw,8rem)] text-cream lg:col-span-8">
            A coleção
          </h2>
          <p className="max-w-sm leading-relaxed text-cream/75 lg:col-span-4 lg:justify-self-end">
            Os modelos da loja com estoque real, Pix ou cartão e frete calculado pelo seu estado.
          </p>
        </div>

        {items.length > 0 ? (
          <ul ref={trackRef} className="mt-16 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-6 sm:gap-6 lg:justify-center lg:overflow-visible">
            {items.map((item) => (
              <li key={item.slug} className="w-[68vw] shrink-0 snap-center sm:w-[42vw] lg:w-[min(22vw,320px)]">
                <Link href={`/produto/${item.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-xs bg-cream">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        fill
                        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 42vw, 68vw"
                        className="object-contain p-[9%] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
                      />
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <h3 className="truncate text-[0.95rem]">{item.name}</h3>
                    <p className="tabular shrink-0 text-sm text-cream/80">{formatBRL(item.priceCents)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-16 rounded-xs border border-cream/15 px-6 py-14 text-center">
            <p className="type-brand text-xl text-cream sm:text-2xl">Os primeiros modelos chegam em breve.</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-cream/70">
              Acompanhe os lançamentos no Instagram enquanto a coleção é preparada.
            </p>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="type-micro mt-6 inline-flex min-h-12 items-center border-b border-cream/40 text-gold-light hover:border-gold-light"
            >
              @maverickcapshop
            </a>
          </div>
        )}

        <div className="mt-14 flex justify-center">
          <RollLink href="/loja" tone="light">
            Explorar a coleção
          </RollLink>
        </div>
      </div>
    </section>
  );
}
