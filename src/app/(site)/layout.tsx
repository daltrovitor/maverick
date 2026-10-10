// Hello World
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteProviders } from "@/components/providers/SiteProviders";
import { getStoreSettings } from "@/lib/catalog";

export const revalidate = 300;

export default async function SiteLayout({ children }: { readonly children: ReactNode }) {
  const settings = await getStoreSettings();
  return (
    <SiteProviders>
      <a
        href="#conteudo"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-sm bg-ink px-4 py-3 text-sm text-paper"
      >
        Pular para o conteúdo
      </a>
      {settings?.announcement ? (
        <div className="relative z-50 bg-ink px-4 py-2 text-center text-xs tracking-wide text-cream">
          {settings.announcement}
        </div>
      ) : null}
      <SiteHeader />
      <main id="conteudo" className="min-h-[70dvh]">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </SiteProviders>
  );
}
