// Hello World
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/lib/auth";
import { errorCode, errorMessage } from "@/lib/errors";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { firstIssue, productInputSchema, slugSchema } from "@/lib/validation";
import type { AdminResult } from "@/app/admin/actions/orders";

function revalidateStorefront(slug?: string) {
  revalidatePath("/");
  revalidatePath("/loja");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/produto/${slug}`);
  revalidatePath("/admin/produtos");
}

async function guarded<T extends AdminResult>(fn: () => Promise<T>): Promise<T | AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: errorMessage("forbidden") };
    console.error("[admin/catalog]", err);
    return { ok: false, message: errorMessage("unknown") };
  }
}

export async function saveProduct(input: unknown): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
    const p = parsed.data;

    const { data: previous } = await db.from("products").select("slug").eq("id", p.id).maybeSingle();
    const { data, error } = await db.rpc("admin_save_product", {
      p: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        specs: p.specs,
        category_id: p.categoryId,
        status: p.status,
        is_featured: p.isFeatured,
        position: p.position,
        seo_title: p.seoTitle ?? "",
        seo_description: p.seoDescription ?? "",
        variants: p.variants.map((v, i) => ({
          id: v.id,
          sku: v.sku,
          color: v.color,
          size: v.size,
          price_cents: v.priceCents,
          compare_at_cents: v.compareAtCents ?? null,
          stock: v.stock,
          is_active: v.isActive,
          position: i,
        })),
        images: p.images.map((img, i) => ({
          storage_path: img.storagePath,
          alt: img.alt,
          color: img.color,
          position: i,
          width: img.width ?? null,
          height: img.height ?? null,
        })),
      },
    });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };

    // Remove do Storage as fotos que saíram do produto (após o commit no banco).
    const removed = z.object({ removed_paths: z.array(z.string()) }).safeParse(data);
    if (removed.success && removed.data.removed_paths.length > 0) {
      const { error: rmError } = await db.storage.from(PRODUCT_IMAGES_BUCKET).remove(removed.data.removed_paths);
      if (rmError) console.error("[admin/catalog] storage remove", rmError.message);
    }

    revalidateStorefront(p.slug);
    if (previous?.slug && previous.slug !== p.slug) revalidatePath(`/produto/${previous.slug}`);
    return { ok: true, message: p.status === "active" ? "Produto salvo e publicado." : "Produto salvo." };
  });
}

export async function deleteProduct(productId: string): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const id = z.uuid().parse(productId);
    const { data: product } = await db.from("products").select("slug").eq("id", id).maybeSingle();
    const { data, error } = await db.rpc("admin_delete_product", { p_id: id });
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    const result = z.object({ archived: z.boolean(), removed_paths: z.array(z.string()) }).parse(data);
    if (result.removed_paths.length > 0) {
      await db.storage.from(PRODUCT_IMAGES_BUCKET).remove(result.removed_paths);
    }
    revalidateStorefront(product?.slug);
    return {
      ok: true,
      message: result.archived ? "O produto tem pedidos, então foi arquivado (sai da loja e mantém o histórico)." : "Produto excluído.",
    };
  });
}

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome").max(80),
  slug: slugSchema,
  position: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
});

export async function saveCategory(input: unknown): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
    const c = parsed.data;
    const row = { name: c.name, slug: c.slug, position: c.position, is_active: c.isActive };
    const { error } = c.id
      ? await db.from("categories").update(row).eq("id", c.id)
      : await db.from("categories").insert(row);
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/categorias");
    revalidatePath("/loja");
    return { ok: true, message: "Categoria salva." };
  });
}

export async function deleteCategory(categoryId: string): Promise<AdminResult> {
  return guarded(async () => {
    const { db } = await requireAdmin("action");
    const { error } = await db.from("categories").delete().eq("id", z.uuid().parse(categoryId));
    if (error) return { ok: false, message: errorMessage(errorCode(error)) };
    revalidatePath("/admin/categorias");
    revalidatePath("/loja");
    return { ok: true, message: "Categoria excluída. Os produtos dela ficaram sem categoria." };
  });
}
