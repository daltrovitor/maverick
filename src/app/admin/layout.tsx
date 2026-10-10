// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { MaverickLogo } from "@/components/brand/MaverickLogo";
import { Button } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/(site)/conta/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel Maverick" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { readonly children: ReactNode }) {
  const { user } = await requireAdmin("page");
  return (
    <div className="min-h-dvh bg-cream/60">
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex min-h-12 items-center gap-3">
            <MaverickLogo variant="monogram" className="h-7 text-ink" />
            <span className="type-brand text-sm">Painel</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
            <Link href="/" className="type-micro inline-flex min-h-12 items-center px-3 text-ink-soft hover:text-ink" target="_blank">
              Ver loja
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <AdminNav />
        <main id="conteudo" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
