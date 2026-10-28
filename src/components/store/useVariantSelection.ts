// Hello World
"use client";

import { useMemo, useState } from "react";
import type { CatalogImage } from "@/lib/catalog";
import type { VariantRow } from "@/lib/database.types";
import { useCart } from "@/components/cart/CartProvider";

const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

export interface VariantProduct {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  readonly variants: VariantRow[];
  readonly images: CatalogImage[];
}

/**
 * Escolha de cor, tamanho e quantidade de um produto + adicionar à sacola (preço e estoque vêm
 * do servidor). Usada pela página de produto e pelo painel da parede da coleção.
 */
export function useVariantSelection({ productId, slug, name, variants, images }: VariantProduct) {
  const { add } = useCart();
  const colors = useMemo(() => unique(variants.map((v) => v.color)), [variants]);
  const sizes = useMemo(() => unique(variants.map((v) => v.size)), [variants]);
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];

  const [color, setColor] = useState<string | null>(firstAvailable?.color ?? null);
  const [size, setSize] = useState<string | null>(firstAvailable?.size ?? null);
  const [quantity, setQuantity] = useState(1);

  const selected = variants.find((v) => v.color === color && v.size === size) ?? null;
  const stock = selected?.stock ?? 0;
  const maxQty = Math.min(stock, 20);

  /** Fotos da cor escolhida primeiro (as sem cor valem para todas). */
  const gallery = useMemo(() => {
    const forColor = color ? images.filter((img) => img.color === color) : [];
    const neutral = images.filter((img) => !img.color);
    const list = forColor.length > 0 ? [...forColor, ...neutral] : images;
    return list.length > 0 ? list : images;
  }, [images, color]);
  // O 3D é pintado com a primeira foto da cor escolhida (cadastre a foto de frente primeiro).
  const cover = gallery[0] ?? null;

  const availableFor = (c: string | null, s: string | null) =>
    variants.some((v) => v.color === c && v.size === s && v.stock > 0);
  const sizeExists = (s: string) => variants.some((v) => v.color === color && v.size === s);
  const colorInStock = (c: string) => variants.some((v) => v.color === c && v.stock > 0);

  const pickColor = (c: string) => {
    setColor(c);
    setQuantity(1);
    if (!variants.some((v) => v.color === c && v.size === size)) {
      setSize(variants.find((v) => v.color === c && v.stock > 0)?.size ?? variants.find((v) => v.color === c)?.size ?? null);
    }
  };

  const pickSize = (s: string) => {
    setSize(s);
    setQuantity(1);
  };

  const addToCart = (imageUrl: string | null) => {
    if (!selected || stock <= 0) return;
    add(
      {
        variantId: selected.id,
        productId,
        slug,
        name,
        variantLabel: [selected.color, selected.size].filter(Boolean).join(" / ") || null,
        imageUrl,
        unitPriceCents: selected.price_cents,
        compareAtCents: selected.compare_at_cents,
        stock,
      },
      quantity,
    );
  };

  return {
    colors,
    sizes,
    color,
    size,
    quantity,
    setQuantity,
    selected,
    stock,
    maxQty,
    gallery,
    cover,
    availableFor,
    sizeExists,
    colorInStock,
    pickColor,
    pickSize,
    addToCart,
  };
}
