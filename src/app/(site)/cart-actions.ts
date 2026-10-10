// Hello World
"use server";

import { z } from "zod";
import { productImageUrl } from "@/lib/storage";
import { getPublicDb } from "@/lib/supabase/server";

export interface CartLineSnapshot {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  stock: number;
}

interface RawVariant {
  id: string;
  color: string | null;
  size: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  product: {
    id: string;
    slug: string;
    name: string;
    status: string;
    images: { storage_path: string; color: string | null; position: number }[] | null;
  } | null;
}

const idsSchema = z.array(z.uuid()).max(20);

/**
 * Dados atuais (preço, estoque, disponibilidade) das variantes da sacola.
 * Variantes inativas ou de produtos fora do ar simplesmente não voltam.
 */
export async function refreshCartLines(variantIds: string[]): Promise<CartLineSnapshot[]> {
  const ids = idsSchema.safeParse(variantIds);
  if (!ids.success || ids.data.length === 0) return [];
  const db = getPublicDb();
  if (!db) return [];
  const { data, error } = await db
    .from("product_variants")
    .select(
      "id, color, size, price_cents, compare_at_cents, stock, product:products(id, slug, name, status, images:product_images(storage_path, color, position))",
    )
    .in("id", ids.data)
    .eq("is_active", true)
    .returns<RawVariant[]>();
  if (error || !data) return [];

  return data
    .filter((v) => v.product && v.product.status === "active")
    .map((v) => {
      const product = v.product!;
      const images = (product.images ?? []).slice().sort((a, b) => a.position - b.position);
      const image = images.find((i) => i.color && i.color === v.color) ?? images[0];
      return {
        variantId: v.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantLabel: [v.color, v.size].filter(Boolean).join(" / ") || null,
        imageUrl: productImageUrl(image?.storage_path),
        unitPriceCents: v.price_cents,
        compareAtCents: v.compare_at_cents,
        stock: v.stock,
      };
    });
}
