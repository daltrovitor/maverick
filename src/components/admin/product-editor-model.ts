// Hello World
import { centsToInput } from "@/lib/br";
import type { DimonaFiles, Fulfillment, ProductSpec, ProductStatus } from "@/lib/database.types";

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
  dimonaSkuId: string;
}

/** Links das artes/mockups por lado (texto livre no editor; validado no servidor). */
export type EditorDimonaFiles = { front: string; back: string; left_sleeve: string; right_sleeve: string };

export function filesToEditor(files: DimonaFiles | null | undefined): EditorDimonaFiles {
  return {
    front: files?.front ?? "",
    back: files?.back ?? "",
    left_sleeve: files?.left_sleeve ?? "",
    right_sleeve: files?.right_sleeve ?? "",
  };
}

export interface EditorProduct {
  id: string;
  isNew: boolean;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  status: ProductStatus;
  fulfillment: Fulfillment;
  dimonaDesigns: EditorDimonaFiles;
  dimonaMocks: EditorDimonaFiles;
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
  dimona_sku_id?: string | null;
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
    dimonaSkuId: v.dimona_sku_id ?? "",
  };
}
