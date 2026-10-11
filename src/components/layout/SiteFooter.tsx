// Hello World
import Link from "next/link";
import { MaverickLogo } from "@/components/brand/MaverickLogo";
import { ViraWebMark } from "@/components/brand/ViraWebMark";
import { MODEL_CREDIT } from "@/components/cap/capModelAnchors";
import { formatBrPhone } from "@/lib/br";
import type { StoreSettingsRow } from "@/lib/database.types";

/** Rodapé em três planos: assinatura monumental ao fundo, colunas úteis e o crédito da Vira Web. */
export function SiteFooter({ settings }: { readonly settings: StoreSettingsRow | null }) {
  const whatsapp = settings?.whatsapp;
  const email = settings?.contact_email;
  const instagram = settings?.instagram_url ?? "https://www.instagram.com/maverickcapshop/";
  const year = 2026;

  return (
    <footer className="on-dark relative overflow-hidden bg-ink text-cream">
      <div className="mx-auto max-w-[1440px] px-4 pt-20 pb-10 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <MaverickLogo variant="full" className="w-56 text-cream sm:w-64" title="Maverick Headwear & Lifestyle" />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-cream/75">
              Curadoria em headwear. Poucos modelos, escolhidos um a um.
            </p>
          </div>

          <nav aria-label="Loja" className="lg:col-span-2">
            <h2 className="type-micro text-gold-light">Loja</h2>
            <ul className="mt-4 grid gap-1 text-sm">
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/loja">
                  Coleção
                </Link>
              </li>
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/carrinho">
                  Sacola
                </Link>
              </li>
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/conta">
                  Minha conta
                </Link>
              </li>
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/afiliados">
                  Programa de afiliados
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Atendimento" className="lg:col-span-3">
            <h2 className="type-micro text-gold-light">Atendimento</h2>
            <ul className="mt-4 grid gap-1 text-sm">
              {whatsapp ? (
                <li>
                  <a
                    className="inline-flex min-h-11 items-center hover:text-gold-light"
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp {formatBrPhone(whatsapp)}
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a className="inline-flex min-h-11 items-center break-all hover:text-gold-light" href={`mailto:${email}`}>
                    {email}
                  </a>
                </li>
              ) : null}
              <li>
                <a
                  className="inline-flex min-h-11 items-center hover:text-gold-light"
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram @maverickcapshop
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Políticas" className="lg:col-span-2">
            <h2 className="type-micro text-gold-light">Políticas</h2>
            <ul className="mt-4 grid gap-1 text-sm">
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/politicas/trocas">
                  Trocas e devoluções
                </Link>
              </li>
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/politicas/envios">
                  Envios e prazos
                </Link>
              </li>
              <li>
                <Link className="inline-flex min-h-11 items-center hover:text-gold-light" href="/politicas/privacidade">
                  Privacidade (LGPD)
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p
          aria-hidden="true"
          className="type-monument pointer-events-none mt-16 -mb-[0.12em] text-center text-[clamp(4.5rem,19vw,17rem)] text-cream/[0.06] select-none"
        >
          Maverick
        </p>

        <div className="flex flex-col gap-4 border-t border-cream/15 pt-6 text-xs text-cream/70 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p>© {year} Maverick Capshop · Headwear &amp; Lifestyle</p>
            {/* Atribuição exigida pela licença do modelo 3D usado na página inicial. */}
            <p className="text-cream/55">
              Modelo 3D do boné:{" "}
              <a href={MODEL_CREDIT.url} target="_blank" rel="noopener noreferrer" className="py-3 underline underline-offset-2 hover:text-cream">
                “{MODEL_CREDIT.title}”, de {MODEL_CREDIT.author}
              </a>{" "}
              (
              <a href={MODEL_CREDIT.licenseUrl} target="_blank" rel="noopener noreferrer" className="py-3 underline underline-offset-2 hover:text-cream">
                {MODEL_CREDIT.license}
              </a>
              ), com textura alterada.
            </p>
          </div>
          <a
            href="https://www.viraweb.dev.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 text-cream/70 transition-colors hover:text-cream"
          >
            <ViraWebMark className="h-3.5 w-auto" />
            Desenvolvido pela Vira Web
          </a>
        </div>
      </div>
    </footer>
  );
}
