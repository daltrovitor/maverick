// Hello World
import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await listProducts();
  const staticPages: MetadataRoute.Sitemap = ["", "/loja", "/afiliados", "/politicas/trocas", "/politicas/envios", "/politicas/privacidade"].map(
    (path) => ({ url: `${siteUrl}${path}`, changeFrequency: path === "/loja" ? "daily" : "monthly", priority: path === "" ? 1 : 0.7 }),
  );
  return [
    ...staticPages,
    ...products.map((p) => ({
      url: `${siteUrl}/produto/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
