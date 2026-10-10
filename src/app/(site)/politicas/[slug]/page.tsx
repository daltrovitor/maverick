// Hello World
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreSettings } from "@/lib/catalog";
import { formatBrPhone } from "@/lib/br";

export const revalidate = 300;

const PAGES = {
  trocas: { title: "Trocas e devoluções" },
  envios: { title: "Envios e prazos" },
  privacidade: { title: "Política de Privacidade" },
} as const;

type Slug = keyof typeof PAGES;

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  return page ? { title: page.title, alternates: { canonical: `/politicas/${slug}` } } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in PAGES)) notFound();
  const page = PAGES[slug as Slug];
  const settings = await getStoreSettings();
  const contact = [
    settings?.contact_email ? `e-mail ${settings.contact_email}` : null,
    settings?.whatsapp ? `WhatsApp ${formatBrPhone(settings.whatsapp)}` : null,
  ]
    .filter(Boolean)
    .join(" ou ");

  const configured = slug === "trocas" ? settings?.exchange_policy : slug === "envios" ? settings?.shipping_policy : null;

  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 pb-24 sm:px-8 sm:pt-16">
      <h1 className="type-brand text-3xl sm:text-4xl">{page.title}</h1>
      {slug === "privacidade" ? (
        <PrivacyContent contact={contact} />
      ) : configured ? (
        <div className="mt-10 leading-relaxed whitespace-pre-line text-ink-soft">{configured}</div>
      ) : (
        <p className="mt-10 leading-relaxed text-ink-soft">
          Esta política está sendo finalizada pela loja.{" "}
          {contact ? `Em caso de dúvida, fale com a gente pelo ${contact}.` : "Em caso de dúvida, fale com a gente pelo Instagram @maverickcapshop."}
        </p>
      )}
    </article>
  );
}

function PrivacyContent({ contact }: { readonly contact: string }) {
  return (
    <div className="mt-10 grid gap-8 leading-relaxed text-ink-soft">
      <section>
        <h2 className="type-micro text-ink">Quais dados coletamos</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong className="text-ink">Compras:</strong> nome, e-mail, telefone e endereço de entrega, usados para
            processar, entregar e dar suporte ao pedido.
          </li>
          <li>
            <strong className="text-ink">Cartão de crédito:</strong> processado pelo Stripe. A loja não recebe nem armazena o
            número do cartão.
          </li>
          <li>
            <strong className="text-ink">Conta (opcional):</strong> nome, e-mail, telefone e senha (guardada de forma
            criptografada pelo provedor de autenticação).
          </li>
          <li>
            <strong className="text-ink">Programa de afiliados:</strong> nome, CPF, telefone, e-mail, perfil público e as
            respostas da candidatura, usados para validar a identidade, impedir cadastros duplicados (CPF + telefone),
            analisar a elegibilidade e entrar em contato.
          </li>
          <li>
            <strong className="text-ink">Segurança:</strong> um resumo criptográfico (hash) do endereço IP para limitar
            abusos. O IP em si não é armazenado.
          </li>
        </ul>
      </section>
      <section>
        <h2 className="type-micro text-ink">Compartilhamento</h2>
        <p className="mt-3">
          Os dados ficam em infraestrutura contratada pela loja (banco de dados e hospedagem) e são compartilhados apenas
          com quem é necessário para concluir a compra: o processador de pagamento (Stripe) e o serviço de entrega.
        </p>
      </section>
      <section>
        <h2 className="type-micro text-ink">Seus direitos (LGPD)</h2>
        <p className="mt-3">
          Você pode pedir acesso, correção ou exclusão dos seus dados, além de informações sobre o tratamento. Dados
          ligados a pedidos podem ser mantidos pelo prazo exigido pela legislação fiscal. Para as regras do programa de
          afiliados, a combinação de CPF e telefone é mantida para impedir novas candidaturas duplicadas.
        </p>
        <p className="mt-3">
          {contact ? `Contato: ${contact}.` : "Contato: Instagram @maverickcapshop."}
        </p>
      </section>
    </div>
  );
}
