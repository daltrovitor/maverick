// Hello World
import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { BrandSprites } from "@/components/brand/BrandSprites";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

/*
 * Apenas duas famílias, pré-carregadas e com fallback métrico ajustado. `display: "optional"`:
 * se a fonte não chegar no período de bloqueio, o fallback fica até o fim da visita — sem troca
 * tardia, a quebra de linha do título monumental nunca desloca o layout (CLS 0).
 */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "optional",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "optional",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "ViraWeb × Maverick — Proposta de Parceria Estratégica",
  description:
    "Proposta interativa da ViraWeb para a Maverick Headwear & Lifestyle: e-commerce de alta conversão com boné em 3D, programa de afiliados, linha Maverick Gym e máquina de conteúdo orgânico em troca de 25% de equity e 25% dos lucros.",
  applicationName: "ViraWeb × Maverick",
  authors: [{ name: "ViraWeb", url: "https://viraweb.online" }],
  creator: "ViraWeb",
  keywords: [
    "Maverick Headwear",
    "ViraWeb",
    "e-commerce de bonés",
    "boné premium",
    "parceria tech partner",
    "venture studio",
  ],
  openGraph: {
    title: "ViraWeb × Maverick — Do conceito ao domínio do mercado",
    description:
      "E-commerce com boné 3D interativo, afiliados, linha Gym e simulador do acordo de 25% equity + 25% lucros.",
    type: "website",
    locale: "pt_BR",
    siteName: "ViraWeb × Maverick",
  },
  twitter: {
    card: "summary",
    title: "ViraWeb × Maverick — Proposta de Parceria Estratégica",
    description: "A infraestrutura digital definitiva para a Maverick Headwear & Lifestyle.",
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
    shortcut: ["/favicon.png"],
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-white text-ink antialiased selection:bg-[#1f1612] selection:text-white" suppressHydrationWarning>
        <BrandSprites />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
