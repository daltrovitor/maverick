// Hello World
import "server-only";
import { cache } from "react";
import type { CategoryRow, ProductSpec, ShippingRateRow, StoreSettingsRow, VariantRow } from "@/lib/database.types";
import type { ShippingPricing } from "@/lib/shipping-pricing";
import { productImageUrl } from "@/lib/storage";
import { getPublicDb } from "@/lib/supabase/server";

export interface CatalogImage {
  url: string;
  alt: string;
  color: string | null;
  width: number | null;
  height: number | null;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  specs: ProductSpec[];
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  category: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  variants: VariantRow[];
  images: CatalogImage[];
  minPriceCents: number;
  maxPriceCents: number;
  compareAtCents: number | null;
  totalStock: number;
  colors: string[];
  sizes: string[];
}

const PRODUCT_SELECT =
  "id, slug, name, description, specs, is_featured, position, seo_title, seo_description, updated_at, created_at, " +
  "category:categories(id, name, slug), variants:product_variants(*), images:product_images(*)";

interface RawProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  specs: ProductSpec[] | null;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
  category: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  variants: VariantRow[] | null;
  images:
    | { storage_path: string; alt: string; color: string | null; width: number | null; height: number | null; position: number }[]
    | null;
}

function toCatalogProduct(raw: RawProduct): CatalogProduct | null {
  const variants = (raw.variants ?? []).filter((v) => v.is_active).sort((a, b) => a.position - b.position);
  if (variants.length === 0) return null;
  const prices = variants.map((v) => v.price_cents);
  const minPrice = Math.min(...prices);
  const cheapest = variants.find((v) => v.price_cents === minPrice);
  const images = (raw.images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((img) => ({
      url: productImageUrl(img.storage_path) ?? "",
      alt: img.alt || raw.name,
      color: img.color,
      width: img.width,
      height: img.height,
    }))
    .filter((img) => img.url);
  const unique = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    specs: Array.isArray(raw.specs) ? raw.specs : [],
    isFeatured: raw.is_featured,
    seoTitle: raw.seo_title,
    seoDescription: raw.seo_description,
    updatedAt: raw.updated_at,
    category: raw.category,
    variants,
    images,
    minPriceCents: minPrice,
    maxPriceCents: Math.max(...prices),
    compareAtCents: cheapest?.compare_at_cents ?? null,
    totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
    colors: unique(variants.map((v) => v.color)),
    sizes: unique(variants.map((v) => v.size)),
  };
}

export type CatalogSort = "destaque" | "menor-preco" | "maior-preco" | "novidades";

export interface CatalogResult {
  products: CatalogProduct[];
  configured: boolean;
  error: boolean;
}

export const listProducts = cache(async (): Promise<CatalogResult> => {
  const db = getPublicDb();
  if (!db) return { products: [], configured: false, error: false };
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<RawProduct[]>();
  if (error) {
    console.error("[catalog] listProducts", error.message);
    return { products: [], configured: true, error: true };
  }
  return {
    products: (data ?? []).map(toCatalogProduct).filter((p): p is CatalogProduct => p !== null),
    configured: true,
    error: false,
  };
});

export const getProductBySlug = cache(async (slug: string): Promise<CatalogProduct | null> => {
  const db = getPublicDb();
  if (!db || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const { data, error } = await db
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<RawProduct>();
  if (error) {
    console.error("[catalog] getProductBySlug", error.message);
    return null;
  }
  return data ? toCatalogProduct(data) : null;
});

export const listCategories = cache(async (): Promise<Pick<CategoryRow, "id" | "name" | "slug">[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data } = await db.from("categories").select("id, name, slug").eq("is_active", true).order("position");
  return data ?? [];
});

export const getStoreSettings = cache(async (): Promise<StoreSettingsRow | null> => {
  const db = getPublicDb();
  if (!db) return null;
  const { data } = await db.from("store_settings").select("*").maybeSingle();
  return data ?? null;
});

export const listShippingRates = cache(async (): Promise<ShippingRateRow[]> => {
  const db = getPublicDb();
  if (!db) return [];
  const { data } = await db.from("shipping_rates").select("*").eq("is_active", true).order("uf");
  return data ?? [];
});

/** Regra de vitrine do frete: UFs atendidas e se o frete entra no preço (chave do painel). */
export const getShippingPricing = cache(async (): Promise<ShippingPricing> => {
  const [settings, rates] = await Promise.all([getStoreSettings(), listShippingRates()]);
  return {
    // Antes da migração a coluna não existe: segue o frete cobrado à parte.
    inPrice: settings?.shipping_in_price === true,
    rates: rates.map((r) => ({ uf: r.uf, cents: r.price_cents, estimate: r.delivery_estimate })),
  };
});
