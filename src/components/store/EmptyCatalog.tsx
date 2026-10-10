// Hello World
import { MaverickLogo } from "@/components/brand/MaverickLogo";

/**
 * Estado vazio honesto: nenhum produto fictício. Aparece até a primeira peça real ser
 * publicada pelo painel.
 */
export function EmptyCatalog({ instagramUrl }: { readonly instagramUrl?: string | null }) {
  return (
    <section
      aria-labelledby="empty-title"
      className="relative overflow-hidden rounded-xs border border-line bg-cream px-6 py-20 text-center sm:py-28"
    >
      <MaverickLogo variant="monogram" className="mx-auto h-12 text-ink" />
      <h2 id="empty-title" className="type-brand mx-auto mt-8 max-w-xl text-2xl sm:text-3xl">
        A coleção está sendo preparada
      </h2>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-ink-soft">
        Cada modelo entra na loja depois de escolhido um a um. Os primeiros bonés chegam aqui em breve.
      </p>
      <a
        href={instagramUrl ?? "https://www.instagram.com/maverickcapshop/"}
        target="_blank"
        rel="noopener noreferrer"
        className="type-micro mt-8 inline-flex min-h-12 items-center border-b border-ink/40 hover:border-ink"
      >
        Acompanhe os lançamentos no Instagram
      </a>
    </section>
  );
}
