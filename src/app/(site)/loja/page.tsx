// Hello World
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogView } from "@/components/store/CatalogView";
import { EmptyCatalog } from "@/components/store/EmptyCatalog";
import { getStoreSettings, listCategories, listProducts } from "@/lib/catalog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Coleção",
  description: "Bonés selecionados pela Maverick Capshop: trucker, dad hat e clássicos. Pix ou cartão.",
  alternates: { canonical: "/loja" },
};

export default async function StorePage() {
  const [{ products, error }, categories, settings] = await Promise.all([
    listProducts(),
    listCategories(),
    getStoreSettings(),
  ]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-10 pb-24 sm:px-8 sm:pt-16">
      <header className="relative mb-10 grid gap-6 lg:grid-cols-12 lg:items-end">
        <h1 className="type-monument text-[clamp(3.5rem,12vw,10rem)] text-ink lg:col-span-8">Coleção</h1>
        <p className="max-w-sm leading-relaxed text-ink-soft lg:col-span-4 lg:justify-self-end">
          Poucos modelos, escolhidos um a um. Estoque real, atualizado a cada pedido.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-xs border border-danger/30 bg-[#fbeeed] px-4 py-3 text-sm text-danger">
          Não foi possível carregar a coleção agora. Atualize a página em instantes.
        </p>
      ) : products.length === 0 ? (
        <EmptyCatalog instagramUrl={settings?.instagram_url} />
      ) : (
        <Suspense fallback={null}>
          <CatalogView products={products} categories={categories} />
        </Suspense>
      )}
    </div>
  );
}
