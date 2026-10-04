// Hello World
import { MaverickLockup, ViraWebLockup } from "@/components/brand/Wordmarks";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function SiteFooter() {
  const contactUrl = buildWhatsAppUrl("Olá, ViraWeb! Vi a proposta da parceria com a Maverick e quero conversar.");
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-10">
        <div className="flex flex-wrap items-center gap-4 lg:col-span-6">
          <ViraWebLockup withTagline />
          <span aria-hidden="true" className="font-mono text-sm text-muted">
            ×
          </span>
          <MaverickLockup withTagline />
        </div>
        <div className="text-sm leading-relaxed text-ink-soft lg:col-span-4 lg:col-start-9">
          <p>Proposta confidencial preparada pela ViraWeb para o fundador da Maverick Headwear &amp; Lifestyle. Outubro de 2026.</p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
            <li>
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
              >
                Falar com a ViraWeb no WhatsApp
              </a>
            </li>
            <li>
              <a
                href="https://viraweb.online"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
              >
                Conhecer o site da ViraWeb
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/maverickcapshop/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink"
              >
                Instagram da Maverick
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
