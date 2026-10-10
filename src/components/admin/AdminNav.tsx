// Hello World
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/frete", label: "Frete por estado" },
  { href: "/admin/cupons", label: "Cupons" },
  { href: "/admin/afiliados", label: "Afiliados" },
  { href: "/admin/configuracoes", label: "Configurações" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Painel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:sticky lg:top-24 lg:flex-col">
        {ITEMS.map((item) => {
          const active = "exact" in item ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-sm px-3 text-sm whitespace-nowrap transition-colors ${
                  active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
