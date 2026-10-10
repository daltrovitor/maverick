// Hello World
import Image from "next/image";
import Link from "next/link";
import { AdminHeader, EmptyState, TableWrap } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth";
import { formatBRL } from "@/lib/br";
import { productImageUrl } from "@/lib/storage";

export const metadata = { title: "Produtos" };

const STATUS = {
  active: { label: "Publicado", tone: "positive" },
  draft: { label: "Rascunho", tone: "neutral" },
  archived: { label: "Arquivado", tone: "negative" },
} as const;

export default async function AdminProducts() {
  const { db } = await requireAdmin();
  const { data: products, error } = await db
    .from("products")
    .select("id, name, slug, status, is_featured, position, variants:product_variants(price_cents, stock, is_active), images:product_images(storage_path, position)")
    .order("position")
    .order("created_at", { ascending: false });

  return (
    <div>
      <AdminHeader
        title="Produtos"
        description="Somente produtos publicados aparecem na loja. A ordem segue o campo “posição”."
        actions={<ButtonLink href="/admin/produtos/novo">Novo produto</ButtonLink>}
      />
      {error ? (
        <EmptyState>Não foi possível carregar os produtos.</EmptyState>
      ) : !products || products.length === 0 ? (
        <EmptyState>
          Nenhum produto cadastrado. <Link href="/admin/produtos/novo" className="underline">Cadastre o primeiro.</Link>
        </EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preço</th>
              <th className="text-right">Estoque</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const active = (p.variants ?? []).filter((v) => v.is_active);
              const prices = active.map((v) => v.price_cents);
              const stock = active.reduce((s, v) => s + v.stock, 0);
              const cover = (p.images ?? []).slice().sort((a, b) => a.position - b.position)[0];
              const url = productImageUrl(cover?.storage_path);
              const st = STATUS[p.status];
              return (
                <tr key={p.id} className="hover:bg-cream/60">
                  <td>
                    <Link href={`/admin/produtos/${p.id}`} className="flex min-h-12 items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-xs bg-cream">
                        {url ? <Image src={url} alt="" fill sizes="48px" className="object-contain p-1" /> : null}
                      </span>
                      <span>
                        <span className="block font-medium hover:underline">{p.name}</span>
                        <span className="block text-xs text-muted">/{p.slug}{p.is_featured ? " · destaque" : ""}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="tabular">
                    {prices.length === 0 ? "—" : Math.min(...prices) === Math.max(...prices) ? formatBRL(prices[0] ?? 0) : `${formatBRL(Math.min(...prices))} – ${formatBRL(Math.max(...prices))}`}
                  </td>
                  <td className={`tabular text-right ${stock === 0 ? "text-danger" : stock <= 3 ? "text-gold-ink" : ""}`}>{stock}</td>
                  <td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
