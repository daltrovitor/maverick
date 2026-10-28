// Hello World
import type { Metadata } from "next";
import { BrandIntro } from "@/components/brand/BrandIntro";
import { CollectionWall, type WallItem } from "@/components/collection/CollectionWall";
import { AffiliateBand, Facts, Statement } from "@/components/landing/BrandSections";
import { CustomCapSection } from "@/components/landing/CustomCapSection";
import { getStoreSettings, listProducts } from "@/lib/catalog";
import { pricingFromSettings, type CustomPricing } from "@/lib/custom-pricing";
import { siteUrl } from "@/lib/env";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Quantos bonés cabem na parede (o resto fica na /loja). */
const WALL_SIZE = 10;

/** Primeira frase da descrição, curta o bastante para a vista de perto. */
function summaryOf(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  const sentence = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
}

/** Regra padrão da calculadora enquanto a loja não salva a própria (mesmos padrões do banco). */
const DEFAULT_PRICING: CustomPricing = {
  unitPriceCents: null,
  minQuantity: 1,
  maxQuantity: 1000,
  stepUnits: 10,
  stepBps: 500,
  maxDiscountBps: 3000,
};

export default async function HomePage() {
  const [{ products }, settings] = await Promise.all([listProducts(), getStoreSettings()]);
  // Destaques primeiro, depois o resto do catálogo na ordem da loja.
  const wall: WallItem[] = [...products.filter((p) => p.isFeatured), ...products.filter((p) => !p.isFeatured)]
    .slice(0, WALL_SIZE)
    .map((p) => ({
      productId: p.id,
      slug: p.slug,
      name: p.name,
      summary: summaryOf(p.description),
      priceCents: p.minPriceCents,
      variants: p.variants,
      images: p.images,
    }));
  const instagramUrl = settings?.instagram_url ?? "https://www.instagram.com/maverickcapshop/";
  const customPricing = settings && "custom_step_units" in settings ? pricingFromSettings(settings) : DEFAULT_PRICING;
  const customEnabled = settings?.custom_enabled !== false;

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
      <BrandIntro />
      <CollectionWall items={wall} />
      {customEnabled ? <CustomCapSection pricing={customPricing} /> : null}
      <Statement />
      <Facts />
      <AffiliateBand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
