// Hello World
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { MaverickLogo } from "@/components/brand/MaverickLogo";
import { useCart } from "@/components/cart/CartProvider";

const NAV = [
  { href: "/loja", label: "Coleção" },
  { href: "/afiliados", label: "Afiliados" },
  { href: "/conta", label: "Conta" },
] as const;

/**
 * Cabeçalho fixo e discreto: monograma à esquerda, navegação em micro-tipografia e a sacola.
 * Sobre a abertura escura da página inicial ele inverte para creme até a rolagem começar.
 */
export function SiteHeader({ overDark = false }: { readonly overDark?: boolean }) {
  const pathname = usePathname();
  const { count, open, ready } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const dialog = menuRef.current;
    if (!dialog) return;
    if (menuOpen && !dialog.open) dialog.showModal();
    if (!menuOpen && dialog.open) dialog.close();
  }, [menuOpen]);

  // Fecha o menu ao navegar.
  useEffect(() => setMenuOpen(false), [pathname]);

  const dark = overDark && !scrolled;
  const tone = dark ? "text-cream" : "text-ink";

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,color] duration-300 ${
        dark ? "border-b border-transparent bg-transparent on-dark" : "border-b border-line bg-paper/92 backdrop-blur-md"
      } ${tone}`}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link href="/" className="flex min-h-12 items-center gap-3" aria-label="Maverick — página inicial">
          <MaverickLogo variant="monogram" className="h-7 sm:h-8" />
          <span className="type-brand hidden text-[0.95rem] sm:inline">Maverick</span>
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`type-micro inline-flex min-h-12 items-center px-4 transition-opacity hover:opacity-100 ${
                      active ? "opacity-100 underline decoration-gold underline-offset-[6px]" : "opacity-75"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={open}
            className="type-micro inline-flex min-h-12 items-center gap-2 rounded-sm px-3 hover:opacity-80"
            aria-label={`Abrir sacola${ready && count > 0 ? `, ${count} ${count === 1 ? "item" : "itens"}` : ""}`}
          >
            Sacola
            <span className="tabular" aria-hidden="true">
              ({ready ? count : 0})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-12 place-items-center rounded-sm md:hidden"
            aria-label="Abrir menu"
            aria-haspopup="dialog"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <dialog
        ref={menuRef}
        onClose={() => setMenuOpen(false)}
        aria-label="Menu"
        className="fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none bg-ink p-0 text-cream on-dark backdrop:bg-transparent"
      >
        <div className="flex h-full flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <div className="flex h-16 items-center justify-between">
            <MaverickLogo variant="monogram" className="h-7 text-cream" title="Maverick" />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid size-12 place-items-center rounded-sm"
              aria-label="Fechar menu"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Menu móvel" className="mt-10">
            <ul className="grid gap-2">
              {[{ href: "/", label: "Início" }, ...NAV].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="type-monument block py-2 text-5xl text-cream">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="type-micro mt-auto text-gold-light">Headwear &amp; Lifestyle · Est. 2026</p>
        </div>
      </dialog>
    </header>
  );
}
