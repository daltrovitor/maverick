// Hello World
"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Menu, RotateCcw, X } from "lucide-react";
import { MaverickMonogram } from "@/components/brand/MaverickMonogram";
import { replayPartnershipIntro } from "@/components/brand/PartnershipIntro";
import { ViraWebLogo } from "@/components/brand/ViraWebLogo";
import { NAV_ITEMS } from "@/lib/content";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      data-site-header
      className={`sticky top-0 z-40 border-b bg-white transition-colors duration-300 ${
        scrolled ? "border-line" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <a
          href="#alianca"
          className="flex min-h-12 items-center gap-2.5 rounded-xs sm:gap-3"
        >
          <ViraWebLogo className="h-6 w-auto sm:h-7" />
          <span className="hidden font-sans text-[15px] font-semibold tracking-tight text-navy sm:inline">ViraWeb</span>
          <span aria-hidden="true" className="font-mono text-xs text-muted">
            ×
          </span>
          <MaverickMonogram className="h-6 w-auto sm:h-7" />
          <span className="font-display text-[15px] tracking-[0.22em] text-ink sm:text-[17px]">MAVERICK</span>
          <span className="sr-only">, voltar ao início</span>
        </a>

        <nav aria-label="Seções da proposta" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="inline-flex min-h-12 items-center rounded-xs px-3 text-sm text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={replayPartnershipIntro}
            aria-label="Rever a animação de abertura da proposta"
            className="hidden min-h-11 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink hover:bg-cream cursor-pointer sm:inline-flex"
          >
            <RotateCcw className="size-3.5 text-[#b48328]" aria-hidden="true" />
            <span>Rever animação</span>
          </button>
          <a
            href="#proposta"
            className="hidden min-h-11 items-center rounded-sm bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-espresso sm:inline-flex"
          >
            Ver o acordo
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="inline-flex size-12 items-center justify-center rounded-sm text-ink lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <m.nav
            id="menu-mobile"
            aria-label="Seções da proposta"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="border-t border-line bg-white lg:hidden"
          >
            <ul className="mx-auto max-w-[1320px] px-4 py-2 sm:px-6">
              {NAV_ITEMS.map((item, index) => (
                <li key={item.href} className="border-b border-line last:border-b-0">
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center justify-between py-3 font-serif text-2xl text-ink"
                  >
                    {item.label}
                    <span className="tabular font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                  </a>
                </li>
              ))}
              <li className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    replayPartnershipIntro();
                  }}
                  aria-label="Rever a animação de abertura da proposta"
                  className="flex w-full min-h-12 items-center justify-between py-2 font-mono text-sm font-semibold uppercase tracking-wider text-ink cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="size-4 text-[#b48328]" aria-hidden="true" />
                    Rever animação
                  </span>
                  <span className="font-mono text-xs text-muted">INTRO</span>
                </button>
              </li>
            </ul>
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
