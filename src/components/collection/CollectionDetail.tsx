// Hello World
"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { WallItem } from "@/components/collection/CollectionWall";
import { useVariantSelection } from "@/components/store/useVariantSelection";
import { FreeShippingNote, StorePrice } from "@/components/delivery/StorePrice";
import { useDelivery } from "@/components/delivery/DeliveryProvider";

const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  readonly item: WallItem;
  readonly index: number;
  readonly total: number;
  readonly onBack: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  /** Foto que pinta o boné 3D (muda com a cor escolhida). */
  readonly onCover: (url: string | null) => void;
}

/**
 * Vista de perto de um boné da parede: nome e resumo à esquerda (sobre o 3D), compra à direita
 * (no celular, embaixo). Mesmas regras de cor, tamanho e estoque da página do produto.
 */
export function CollectionDetail({ item, index, total, onBack, onPrev, onNext, onCover }: Props) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { pricing } = useDelivery();
  const shippingInPrice = pricing.inPrice && pricing.rates.length > 0;
  const { colors, sizes, color, size, selected, stock, cover, availableFor, sizeExists, colorInStock, pickColor, pickSize, addToCart } =
    useVariantSelection({ productId: item.productId, slug: item.slug, name: item.name, variants: item.variants, images: item.images });
  const coverUrl = cover?.url ?? null;
  // onCover muda a cada render do pai; só a troca de foto deve repintar o boné.
  const onCoverRef = useRef(onCover);
  useEffect(() => {
    onCoverRef.current = onCover;
  });

  useEffect(() => {
    onCoverRef.current(coverUrl);
  }, [coverUrl]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div role="region" aria-labelledby={titleId} className="detail-enter absolute inset-0 z-20 pointer-events-none">
      {/* Nome e resumo sobre o boné */}
      <div className="pointer-events-auto absolute top-0 left-0 max-w-[min(34rem,92%)] px-4 pt-4 sm:px-8 sm:pt-7">
        <button
          type="button"
          onClick={onBack}
          className="type-micro -ml-1 inline-flex min-h-12 items-center gap-2 px-1 text-cream/85 transition-colors hover:text-gold-light"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Coleção
        </button>
        <h2
          ref={titleRef}
          id={titleId}
          tabIndex={-1}
          className="type-brand text-[clamp(1.5rem,3.4vw,2.6rem)] leading-tight text-cream outline-none"
        >
          {item.name}
        </h2>
        <p className="type-micro mt-1 text-gold-light">
          {pad(index + 1)} / {pad(total)}
        </p>
        {item.summary ? <p className="mt-3 hidden max-w-sm text-sm leading-relaxed text-cream/80 sm:block">{item.summary}</p> : null}
      </div>

      {/* Compra */}
      <div
        data-lenis-prevent
        className="detail-panel pointer-events-auto absolute inset-x-0 bottom-0 max-h-[52%] overflow-y-auto border-t border-cream/15 bg-barn/92 px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:inset-x-auto sm:top-24 sm:right-6 sm:bottom-20 sm:max-h-none sm:w-[min(24rem,42%)] sm:rounded-sm sm:border sm:px-6 sm:pb-6 lg:right-8 lg:w-[min(26rem,34%)]"
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="type-micro text-cream/75">Maverick Capshop</p>
          <p className="tabular text-xl font-medium text-cream">
            {selected ? (
              <StorePrice baseCents={selected.price_cents} compareAtCents={selected.compare_at_cents} compareClassName="mr-2 text-sm text-cream/60 line-through" />
            ) : (
              <StorePrice baseCents={item.priceCents} />
            )}
          </p>
        </div>
        {shippingInPrice ? <FreeShippingNote className="mt-1 text-right text-xs text-cream/75" /> : null}

        {colors.length > 0 ? (
          <fieldset className="mt-5">
            <legend className="type-micro text-cream/75">
              Cor <span className="ml-2 normal-case tracking-normal text-cream">{color}</span>
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickColor(c)}
                  aria-pressed={color === c}
                  className={`min-h-12 rounded-sm border px-4 text-sm transition-colors ${
                    color === c ? "border-cream bg-cream text-ink" : "border-cream/30 hover:border-cream"
                  } ${colorInStock(c) ? "" : "text-cream/50 line-through"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {sizes.length > 0 ? (
          <fieldset className="mt-4">
            <legend className="type-micro text-cream/75">Tamanho</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {sizes.filter(sizeExists).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSize(s)}
                  aria-pressed={size === s}
                  className={`min-h-12 min-w-14 rounded-sm border px-4 text-sm transition-colors ${
                    size === s ? "border-cream bg-cream text-ink" : "border-cream/30 hover:border-cream"
                  } ${availableFor(color, s) ? "" : "text-cream/50 line-through"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <button
          type="button"
          onClick={() => addToCart(coverUrl)}
          disabled={!selected || stock <= 0}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-gold-light px-5 text-sm font-medium text-ink transition-colors hover:bg-cream disabled:bg-cream/20 disabled:text-cream/60"
        >
          {stock <= 0 ? "Esgotado" : "Adicionar à sacola"}
        </button>
        <p className="mt-2 text-xs text-cream/75" aria-live="polite">
          {!selected
            ? "Escolha uma combinação disponível."
            : stock <= 0
              ? "Sem estoque nesta combinação."
              : stock <= 3
                ? stock === 1
                  ? "Última unidade disponível."
                  : `Últimas ${stock} unidades disponíveis.`
                : "Em estoque, pronto para envio."}
        </p>

        <Link
          href={`/produto/${item.slug}`}
          className="type-micro mt-4 inline-flex min-h-12 items-center border-b border-cream/30 text-cream/90 transition-colors hover:border-gold-light hover:text-gold-light"
        >
          Fotos e detalhes do produto
        </Link>

        {total > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-cream/15 pt-3">
            <button type="button" onClick={onPrev} className="type-micro inline-flex min-h-12 items-center gap-2 text-cream/85 hover:text-gold-light">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Anterior
            </button>
            <button type="button" onClick={onNext} className="type-micro inline-flex min-h-12 items-center gap-2 text-cream/85 hover:text-gold-light">
              Próximo
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
