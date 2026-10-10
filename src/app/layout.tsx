// Hello World
import type { Metadata, Viewport } from "next";
import { Archivo, Cinzel, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/Toaster";
import { siteUrl } from "@/lib/env";
import "./globals.css";

/*
 * Três famílias: Archivo (interface + tipografia monumental condensada pelo eixo wdth),
 * Cinzel (serifa romana em caixa alta, eco do wordmark oficial) e JetBrains Mono
 * (micro-anotações do plano frontal). `display: "swap"` com fallback métrico ajustado.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

const DESCRIPTION =
  "Maverick Capshop — curadoria em headwear. Bonés escolhidos um a um, com Pix ou cartão e envio para todo o Brasil.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Maverick Capshop — Headwear & Lifestyle",
    template: "%s · Maverick Capshop",
  },
  description: DESCRIPTION,
  applicationName: "Maverick Capshop",
  keywords: ["bonés", "boné premium", "dad hat", "trucker", "headwear", "Maverick Capshop"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Maverick Capshop",
    title: "Maverick Capshop — Headwear & Lifestyle",
    description: DESCRIPTION,
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Maverick — Headwear & Lifestyle" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maverick Capshop — Headwear & Lifestyle",
    description: DESCRIPTION,
    images: ["/brand/og.png"],
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${cinzel.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-paper text-ink antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
