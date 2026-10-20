// Hello World
import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { filesToEditor, variantToEditor, type EditorProduct } from "@/components/admin/product-editor-model";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Produto" };

/** Edição (id existente) ou criação (/admin/produtos/novo gera um id novo). */
export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAdmin();
  const { data: categories } = await db.from("categories").select("id, name").order("position");

  if (id === "novo") {
    const initial: EditorProduct = {
      id: crypto.randomUUID(),
      isNew: true,
      name: "",
      slug: "",
      description: "",
      categoryId: "",
      status: "draft",
      fulfillment: "stock",
      dimonaDesigns: filesToEditor(null),
      dimonaMocks: filesToEditor(null),
      isFeatured: false,
      position: "0",
      seoTitle: "",
      seoDescription: "",
      specs: [],
      variants: [],
      images: [],
    };
    return (
      <div>
        <AdminHeader title="Novo produto" description="Comece como rascunho; publique quando fotos, preço e estoque estiverem conferidos." />
        <ProductEditor initial={initial} categories={categories ?? []} />
      </div>
    );
  }

  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: product } = await db
    .from("products")
    .select("*, variants:product_variants(*), images:product_images(*)")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();
  const { data: dimona } = await db.from("product_dimona").select("designs, mocks").eq("product_id", id).maybeSingle();

  const initial: EditorProduct = {
    id: product.id,
    isNew: false,
    name: product.name,
    slug: product.slug,
    description: product.description,
    categoryId: product.category_id ?? "",
    status: product.status,
    fulfillment: product.fulfillment ?? "stock",
    dimonaDesigns: filesToEditor(dimona?.designs),
    dimonaMocks: filesToEditor(dimona?.mocks),
    isFeatured: product.is_featured,
    position: String(product.position),
    seoTitle: product.seo_title ?? "",
    seoDescription: product.seo_description ?? "",
    specs: Array.isArray(product.specs) ? product.specs : [],
    variants: (product.variants ?? []).slice().sort((a, b) => a.position - b.position).map(variantToEditor),
    images: (product.images ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((img) => ({
        storagePath: img.storage_path,
        alt: img.alt,
        color: img.color ?? "",
        width: img.width ?? undefined,
        height: img.height ?? undefined,
      })),
  };

  return (
    <div>
      <AdminHeader title={product.name} description={`/produto/${product.slug}`} />
      <ProductEditor initial={initial} categories={categories ?? []} />
    </div>
  );
}
