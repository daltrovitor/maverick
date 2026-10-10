// Hello World
import { CategoryManager } from "@/components/admin/CategoryManager";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Categorias" };

export default async function AdminCategories() {
  const { db } = await requireAdmin();
  const { data } = await db.from("categories").select("id, name, slug, position, is_active").order("position");
  return (
    <div>
      <AdminHeader
        title="Categorias"
        description="Lista simples usada como filtro na coleção. Só aparecem na loja as categorias que têm produtos publicados."
      />
      <CategoryManager categories={data ?? []} />
    </div>
  );
}
