// Hello World
import type { Metadata } from "next";
import { CinematicStory } from "@/components/landing/CinematicStory";
import { AffiliateBand, Facts, Statement } from "@/components/landing/BrandSections";
import { ProductLineup, type LineupItem } from "@/components/landing/ProductLineup";
import { getStoreSettings, listProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/env";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [{ products }, settings] = await Promise.all([listProducts(), getStoreSettings()]);
  const featured = products.filter((p) => p.isFeatured);
  const lineup: LineupItem[] = (featured.length > 0 ? featured : products).slice(0, 7).map((p) => ({
    slug: p.slug,
    name: p.name,
    priceCents: p.minPriceCents,
    imageUrl: p.images[0]?.url ?? null,
    imageAlt: p.images[0]?.alt ?? p.name,
  }));
  // "Ver este boné" leva ao primeiro produto em destaque (o boné da experiência, quando cadastrado).
  const productHref = featured[0] ? `/produto/${featured[0].slug}` : null;
  const instagramUrl = settings?.instagram_url ?? "https://www.instagram.com/maverickcapshop/";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "Maverick Capshop",
    description: "Curadoria em headwear.",
    url: siteUrl,
    logo: `${siteUrl}/brand/maverick-logo@2x.png`,
    image: `${siteUrl}/brand/og.png`,
    sameAs: [instagramUrl],
  };

  return (
    <>
      <CinematicStory productHref={productHref} />
      <ProductLineup items={lineup} instagramUrl={instagramUrl} />
      <Statement />
      <Facts />
      <AffiliateBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
