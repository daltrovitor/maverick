// Hello World
"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Images, Minus, Plus, Rotate3d } from "lucide-react";
import type { CatalogImage } from "@/lib/catalog";
import type { VariantRow } from "@/lib/database.types";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/components/cart/CartProvider";
import { useDelivery } from "@/components/delivery/DeliveryProvider";
import { FreeShippingNote, StorePrice } from "@/components/delivery/StorePrice";

interface Props {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  readonly variants: VariantRow[];
  readonly images: CatalogImage[];
}

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

// three.js e o modelo só carregam quando o cliente abre a vista 3D.
const ProductCap3D = dynamic(() => import("@/components/store/ProductCap3D").then((m) => m.ProductCap3D), {
  ssr: false,
  loading: () => (
    <p className="type-micro absolute inset-x-0 bottom-4 text-center text-muted" role="status">
      Montando o boné em 3D…
    </p>
  ),
});

/**
 * Galeria (fotos + boné 3D gerado da primeira foto da cor escolhida) + seleção de variantes +
 * adicionar à sacola (preço e estoque do servidor).
 */
export function ProductPurchase({ productId, slug, name, variants, images }: Props) {
  const { add } = useCart();
  const { pricing } = useDelivery();
  const shippingInPrice = pricing.inPrice && pricing.rates.length > 0;
  const colors = useMemo(() => unique(variants.map((v) => v.color)), [variants]);
  const sizes = useMemo(() => unique(variants.map((v) => v.size)), [variants]);
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];

  const [color, setColor] = useState<string | null>(firstAvailable?.color ?? null);
  const [size, setSize] = useState<string | null>(firstAvailable?.size ?? null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [view3d, setView3d] = useState(false);

  const selected = variants.find((v) => v.color === color && v.size === size) ?? null;
  const stock = selected?.stock ?? 0;
  const maxQty = Math.min(stock, 20);

  const gallery = useMemo(() => {
    const forColor = color ? images.filter((img) => img.color === color) : [];
    const neutral = images.filter((img) => !img.color);
    const list = forColor.length > 0 ? [...forColor, ...neutral] : images;
    return list.length > 0 ? list : images;
  }, [images, color]);
  const main = gallery[Math.min(activeImage, gallery.length - 1)];
  // O 3D é pintado com a primeira foto da cor escolhida (cadastre a foto de frente primeiro).
  const cover = gallery[0] ?? null;

  const availableFor = (c: string | null, s: string | null) =>
    variants.some((v) => v.color === c && v.size === s && v.stock > 0);
  const sizeExists = (s: string) => variants.some((v) => v.color === color && v.size === s);

  const pickColor = (c: string) => {
    setColor(c);
    setActiveImage(0);
    setQuantity(1);
    if (!variants.some((v) => v.color === c && v.size === size)) {
      setSize(variants.find((v) => v.color === c && v.stock > 0)?.size ?? variants.find((v) => v.color === c)?.size ?? null);
    }
  };

  const handleAdd = () => {
    if (!selected || stock <= 0) return;
    add(
      {
        variantId: selected.id,
        productId,
        slug,
        name,
        variantLabel: [selected.color, selected.size].filter(Boolean).join(" / ") || null,
        imageUrl: main?.url ?? null,
        unitPriceCents: selected.price_cents,
        compareAtCents: selected.compare_at_cents,
        stock,
      },
      quantity,
    );
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      {/* Galeria */}
      <div className="lg:col-span-7">
        <div className="relative aspect-square overflow-hidden rounded-xs bg-cream">
          {view3d && cover ? (
            <ProductCap3D imageUrl={cover.url} productName={name} />
          ) : main ? (
            <Image
              key={main.url}
              src={main.url}
              alt={main.alt}
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="animate-fade-up object-contain p-[7%]"
            />
          ) : (
            <div className="grid h-full place-items-center">
              <span className="type-micro text-muted">Foto em breve</span>
            </div>
          )}
          {cover ? (
            <button
              type="button"
              onClick={() => setView3d((v) => !v)}
              aria-pressed={view3d}
              className="type-micro absolute top-3 right-3 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-sm border border-line-strong bg-paper/90 px-4 text-ink backdrop-blur-sm transition-colors hover:border-ink"
            >
              {view3d ? <Images className="size-4" aria-hidden="true" /> : <Rotate3d className="size-4" aria-hidden="true" />}
              {view3d ? "Ver fotos" : "Ver em 3D"}
            </button>
          ) : null}
        </div>
        {gallery.length > 1 ? (
          <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Fotos do produto">
            {gallery.map((img, i) => (
              <li key={img.url}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveImage(i);
                    setView3d(false);
                  }}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-pressed={!view3d && i === activeImage}
                  className={`relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xs bg-cream outline-offset-2 transition ${
                    !view3d && i === activeImage ? "ring-1 ring-ink" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={img.url} alt="" fill sizes="96px" className="object-contain p-1.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Compra */}
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-28">
          <p className="tabular text-2xl font-medium">
            {selected ? (
              <StorePrice
                baseCents={selected.price_cents}
                compareAtCents={selected.compare_at_cents}
                compareClassName="mr-3 text-lg text-muted line-through"
              />
            ) : (
              "—"
            )}
          </p>
          {shippingInPrice ? (
            <>
              <FreeShippingNote className="mt-1 text-sm text-ink-soft" />
              <p className="mt-0.5 text-sm text-muted">Pix ou cartão de crédito</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Pix ou cartão de crédito · frete calculado pelo seu estado</p>
          )}

          {colors.length > 0 ? (
            <fieldset className="mt-8">
              <legend className="type-micro text-ink-soft">
                Cor <span className="ml-2 normal-case tracking-normal text-ink">{color}</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {colors.map((c) => {
                  const any = variants.some((v) => v.color === c && v.stock > 0);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => pickColor(c)}
                      aria-pressed={color === c}
                      className={`min-h-12 rounded-sm border px-4 text-sm transition-colors ${
                        color === c ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink"
                      } ${any ? "" : "text-muted line-through"}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {sizes.length > 0 ? (
            <fieldset className="mt-6">
              <legend className="type-micro text-ink-soft">Tamanho</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.filter(sizeExists).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSize(s);
                      setQuantity(1);
                    }}
                    aria-pressed={size === s}
                    className={`min-h-12 min-w-14 rounded-sm border px-4 text-sm transition-colors ${
                      size === s ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink"
                    } ${availableFor(color, s) ? "" : "text-muted line-through"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-8 flex items-center gap-3">
            <div className="inline-flex items-center rounded-sm border border-line-strong" role="group" aria-label="Quantidade">
              <button
                type="button"
                className="grid size-12 place-items-center hover:bg-cream-deep disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Diminuir quantidade"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="tabular w-10 text-center" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                className="grid size-12 place-items-center hover:bg-cream-deep disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                aria-label="Aumentar quantidade"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <Button size="lg" className="flex-1" onClick={handleAdd} disabled={!selected || stock <= 0}>
              {stock <= 0 ? "Esgotado" : "Adicionar à sacola"}
            </Button>
          </div>

          <p className="mt-3 text-sm" aria-live="polite">
            {!selected ? (
              <span className="text-muted">Escolha uma combinação disponível.</span>
            ) : stock <= 0 ? (
              <span className="text-danger">Sem estoque nesta combinação.</span>
            ) : stock <= 3 ? (
              <span className="text-gold-ink">
                {stock === 1 ? "Última unidade disponível." : `Últimas ${stock} unidades disponíveis.`}
              </span>
            ) : (
              <span className="text-success">Em estoque, pronto para envio.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
