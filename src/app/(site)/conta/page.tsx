// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { AuthPanel, ProfileForm } from "@/components/account/AuthForms";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL } from "@/lib/br";
import { ORDER_STATUS } from "@/lib/order-status";
import { getServiceDb } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false },
};

const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });

type Props = { searchParams: Promise<{ proximo?: string; acesso?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const { proximo, acesso } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    const next = proximo && proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/conta";
    return (
      <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-24 sm:px-8 sm:pt-16">
        <h1 className="type-monument mb-12 text-center text-[clamp(3rem,10vw,6.5rem)]">Conta</h1>
        <AuthPanel
          next={next}
          notice={next.startsWith("/admin") ? "Entre com uma conta de administrador para acessar o painel." : undefined}
        />
      </div>
    );
  }

  // Pedidos da conta + pedidos feitos como visitante com o mesmo e-mail (já verificado pelo Supabase Auth).
  // Duas consultas parametrizadas (sem interpolar o e-mail em filtros textuais).
  const db = getServiceDb();
  const columns = "id, number, public_token, status, total_cents, created_at, payment_method" as const;
  const [byUser, byEmail] = await Promise.all([
    db.from("orders").select(columns).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    db.from("orders").select(columns).eq("customer_email", user.email.toLowerCase()).order("created_at", { ascending: false }).limit(50),
  ]);
  const merged = new Map([...(byUser.data ?? []), ...(byEmail.data ?? [])].map((o) => [o.id, o]));
  const orders = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 pb-24 sm:px-8 sm:pt-16">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-micro text-muted">Minha conta</p>
          <h1 className="type-brand mt-2 text-3xl sm:text-4xl">
            Olá, {user.profile?.full_name?.split(" ")[0] ?? "cliente"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.profile?.role === "admin" ? <ButtonLink href="/admin">Abrir painel</ButtonLink> : null}
          <form action={signOut}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </header>

      {acesso === "negado" ? (
        <p role="alert" className="mt-6 rounded-xs border border-gold/40 bg-[#fbf3e1] px-3 py-2 text-sm text-gold-ink">
          Esta conta não tem acesso ao painel administrativo.
        </p>
      ) : null}

      <div className="mt-10 grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-labelledby="pedidos">
          <h2 id="pedidos" className="type-micro text-ink-soft">
            Pedidos
          </h2>
          {!orders || orders.length === 0 ? (
            <p className="mt-6 text-ink-soft">
              Você ainda não tem pedidos.{" "}
              <Link href="/loja" className="underline">
                Ver a coleção
              </Link>
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {orders.map((o) => {
                const status = ORDER_STATUS[o.status];
                return (
                  <li key={o.id}>
                    <Link
                      href={`/pedido/${o.public_token}`}
                      className="flex min-h-16 items-center justify-between gap-4 py-4 hover:bg-cream"
                    >
                      <div>
                        <p className="font-medium">Pedido nº {o.number}</p>
                        <p className="text-sm text-muted">{DATE.format(new Date(o.created_at))}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <span className="tabular text-sm">{formatBRL(o.total_cents)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="lg:col-span-5" aria-labelledby="dados">
          <h2 id="dados" className="type-micro mb-6 text-ink-soft">
            Seus dados
          </h2>
          <p className="mb-5 text-sm text-ink-soft">{user.email}</p>
          <ProfileForm fullName={user.profile?.full_name ?? ""} phone={user.profile?.phone?.replace(/^55/, "") ?? ""} />
        </section>
      </div>
    </div>
  );
}
