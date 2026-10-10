// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/store/ProductPurchase";
import { getProductBySlug, listShippingRates } from "@/lib/catalog";
import { formatBRL, ufName } from "@/lib/br";
import { siteUrl } from "@/lib/env";

export const revalidate = 60;

export function generateStaticParams() {
  // Gerado sob demanda (ISR): o catálogo vive no banco e muda pelo painel.
  return [];
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado", robots: { index: false } };
  const description =
    product.seoDescription ?? (product.description.slice(0, 155) || `${product.name} na Maverick Capshop.`);
  const image = product.images[0]?.url;
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      images: image ? [{ url: image, alt: product.images[0]?.alt ?? product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const [product, rates] = await Promise.all([getProductBySlug(slug), listShippingRates()]);
  if (!product) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: "Maverick Capshop" },
    sku: product.variants[0]?.sku ?? undefined,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      url: `${siteUrl}/produto/${product.slug}`,
      priceCurrency: "BRL",
      price: (v.price_cents / 100).toFixed(2),
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    })),
  };

  const cheapestShipping = rates.length > 0 ? Math.min(...rates.map((r) => r.price_cents)) : null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 pb-24 sm:px-8 sm:pt-10">
      <nav aria-label="Trilha" className="type-micro mb-6 text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/loja" className="inline-flex min-h-11 items-center hover:text-ink">
              Coleção
            </Link>
          </li>
          {product.category ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/loja?categoria=${product.category.slug}`} className="inline-flex min-h-11 items-center hover:text-ink">
                  {product.category.name}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <h1 className="type-brand mb-8 max-w-3xl text-3xl leading-tight sm:text-5xl">{product.name}</h1>

      <ProductPurchase
        productId={product.id}
        slug={product.slug}
        name={product.name}
        variants={product.variants}
        images={product.images}
      />

      <div className="mt-20 grid gap-12 border-t border-line pt-12 lg:grid-cols-12">
        {product.description ? (
          <section className="lg:col-span-7" aria-labelledby="sobre">
            <h2 id="sobre" className="type-micro text-ink-soft">
              Sobre o modelo
            </h2>
            <div className="mt-4 max-w-2xl space-y-4 leading-relaxed whitespace-pre-line text-ink-soft">
              {product.description}
            </div>
          </section>
        ) : null}
        <div className="grid gap-10 lg:col-span-5">
          {product.specs.length > 0 ? (
            <section aria-labelledby="ficha">
              <h2 id="ficha" className="type-micro text-ink-soft">
                Ficha técnica
              </h2>
              <dl className="mt-4 divide-y divide-line border-y border-line">
                {product.specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-6 py-3 text-sm">
                    <dt className="text-muted">{spec.label}</dt>
                    <dd className="text-right">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          <section aria-labelledby="entrega">
            <h2 id="entrega" className="type-micro text-ink-soft">
              Entrega
            </h2>
            {rates.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">As regiões de entrega serão informadas no checkout.</p>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Entregamos em {rates.length === 27 ? "todo o Brasil" : `${rates.length} estados`}
                {cheapestShipping !== null ? `, com frete a partir de ${formatBRL(cheapestShipping)}` : ""}. O valor
                exato aparece no checkout pelo estado do endereço.
                {rates.length < 27 ? (
                  <span className="mt-2 block text-xs text-muted">
                    Atendidos: {rates.map((r) => ufName(r.uf)).join(", ")}.
                  </span>
                ) : null}
              </p>
            )}
          </section>
        </div>
      </div>

      <script
        type="application/ld+json"
        // JSON-LD gerado a partir de dados do banco; escapamos "<" para evitar quebra do script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
