// Hello World
import { centsToInput } from "@/lib/br";
import type { ProductSpec, ProductStatus } from "@/lib/database.types";

/** Modelo do editor de produtos (módulo neutro: usado pelo servidor e pelo cliente). */
export interface EditorImage {
  storagePath: string;
  alt: string;
  color: string;
  width?: number;
  height?: number;
}

export interface EditorVariant {
  key: string;
  id?: string;
  sku: string;
  color: string;
  size: string;
  price: string;
  compareAt: string;
  stock: string;
  isActive: boolean;
}

export interface EditorProduct {
  id: string;
  isNew: boolean;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  status: ProductStatus;
  isFeatured: boolean;
  position: string;
  seoTitle: string;
  seoDescription: string;
  specs: ProductSpec[];
  variants: EditorVariant[];
  images: EditorImage[];
}

export function variantToEditor(v: {
  id: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  is_active: boolean;
}): EditorVariant {
  return {
    key: v.id,
    id: v.id,
    sku: v.sku ?? "",
    color: v.color ?? "",
    size: v.size ?? "",
    price: centsToInput(v.price_cents),
    compareAt: v.compare_at_cents ? centsToInput(v.compare_at_cents) : "",
    stock: String(v.stock),
    isActive: v.is_active,
  };
}
