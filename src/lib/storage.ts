// Hello World
export const PRODUCT_IMAGES_BUCKET = "product-images";
/** Bucket privado das artes de boné personalizado (acesso só por URL assinada). */
export const CUSTOM_DESIGNS_BUCKET = "custom-designs";

/** URL pública de uma foto do bucket de produtos (servida pela CDN do Supabase). */
export function productImageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encoded}`;
}
