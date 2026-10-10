// Hello World
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import type { CatalogProduct, CatalogSort } from "@/lib/catalog";
import { ProductCard } from "@/components/store/ProductCard";

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "destaque", label: "Destaques" },
  { value: "novidades", label: "Novidades" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
];

function sortList(products: CatalogProduct[], sort: CatalogSort) {
  const copy = products.slice();
  if (sort === "menor-preco") return copy.sort((a, b) => a.minPriceCents - b.minPriceCents);
  if (sort === "maior-preco") return copy.sort((a, b) => b.minPriceCents - a.minPriceCents);
  if (sort === "novidades") return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return copy.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
}

/**
 * Filtro por categoria e ordenação no cliente: o catálogo é curto (curadoria) e a página
 * continua estática (ISR). O estado fica na URL para links compartilháveis.
 */
export function CatalogView({
  products,
  categories,
}: {
  readonly products: CatalogProduct[];
  readonly categories: { id: string; name: string; slug: string }[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const category = params.get("categoria") ?? "";
  const sortParam = params.get("ordem") as CatalogSort | null;
  const sort: CatalogSort = SORTS.some((s) => s.value === sortParam) ? (sortParam as CatalogSort) : "destaque";

  const usedCategories = useMemo(
    () => categories.filter((c) => products.some((p) => p.category?.slug === c.slug)),
    [categories, products],
  );

  const visible = useMemo(() => {
    const filtered = category ? products.filter((p) => p.category?.slug === category) : products;
    return sortList(filtered, sort);
  }, [products, category, sort]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-line py-3 sm:flex-row sm:items-center sm:justify-between">
        {usedCategories.length > 0 ? (
          <div role="group" aria-label="Filtrar por categoria" className="-mx-1 flex flex-wrap gap-1">
            <FilterChip active={!category} onClick={() => update("categoria", "")}>
              Todos
            </FilterChip>
            {usedCategories.map((c) => (
              <FilterChip key={c.id} active={category === c.slug} onClick={() => update("categoria", c.slug)}>
                {c.name}
              </FilterChip>
            ))}
          </div>
        ) : (
          <p className="type-micro text-muted">
            {products.length} {products.length === 1 ? "modelo" : "modelos"}
          </p>
        )}
        <label className="flex items-center gap-3 text-sm text-ink-soft">
          <span className="type-micro">Ordenar</span>
          <select
            value={sort}
            onChange={(e) => update("ordem", e.target.value === "destaque" ? "" : e.target.value)}
            className="min-h-12 rounded-sm border border-line-strong bg-paper px-3 text-sm text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "produto exibido" : "produtos exibidos"}
      </p>

      {visible.length === 0 ? (
        <p className="py-20 text-center text-ink-soft">Nenhum modelo nesta categoria no momento.</p>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((product, index) => (
            <li key={product.id}>
              <ProductCard product={product} priority={index < 4} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`type-micro min-h-12 rounded-sm px-4 transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-cream-deep"
      }`}
    >
      {children}
    </button>
  );
}
