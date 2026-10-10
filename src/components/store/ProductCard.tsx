// Hello World
import Image from "next/image";
import Link from "next/link";
import { formatBRL } from "@/lib/br";
import type { CatalogProduct } from "@/lib/catalog";

/** Cartão de produto: foto real sobre creme, nome, preço e disponibilidade. */
export function ProductCard({ product, priority = false }: { readonly product: CatalogProduct; readonly priority?: boolean }) {
  const [first, second] = product.images;
  const soldOut = product.totalStock <= 0;
  const priceRange = product.minPriceCents !== product.maxPriceCents;

  return (
    <article className="group relative">
      <Link href={`/produto/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-xs bg-cream">
          {first ? (
            <>
              <Image
                src={first.url}
                alt={first.alt}
                fill
                priority={priority}
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                className={`object-contain p-[8%] transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.035] ${
                  second ? "group-hover:opacity-0" : ""
                }`}
              />
              {second ? (
                <Image
                  src={second.url}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-contain p-[8%] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                />
              ) : null}
            </>
          ) : (
            <div className="grid h-full place-items-center">
              <span className="type-micro text-muted">Foto em breve</span>
            </div>
          )}
          {soldOut ? (
            <span className="type-micro absolute top-3 left-3 rounded-xs bg-paper/90 px-2 py-1 text-ink">Esgotado</span>
          ) : null}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[0.95rem] font-medium">{product.name}</h3>
            {product.colors.length > 1 ? (
              <p className="type-micro mt-1 text-muted">{product.colors.length} cores</p>
            ) : product.category ? (
              <p className="type-micro mt-1 text-muted">{product.category.name}</p>
            ) : null}
          </div>
          <p className="tabular shrink-0 text-right text-[0.95rem]">
            {product.compareAtCents && !priceRange ? (
              <span className="mr-2 text-sm text-muted line-through">{formatBRL(product.compareAtCents)}</span>
            ) : null}
            <span className="font-medium">
              {priceRange ? "a partir de " : ""}
              {formatBRL(product.minPriceCents)}
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}
