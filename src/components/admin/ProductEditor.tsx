// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct, saveProduct } from "@/app/admin/actions/catalog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { parseBRLToCents } from "@/lib/br";
import type { Fulfillment, ProductStatus } from "@/lib/database.types";
import type { EditorDimonaFiles, EditorProduct, EditorVariant } from "@/components/admin/product-editor-model";
import { DIMONA_SIDES, slugify } from "@/lib/validation";

interface VariantPayload {
  id?: string;
  sku: string;
  color: string;
  size: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  isActive: boolean;
  dimonaSkuId: string;
}

const newVariant = (): EditorVariant => ({
  key: crypto.randomUUID(),
  sku: "",
  color: "",
  size: "",
  price: "",
  compareAt: "",
  stock: "0",
  isActive: true,
  dimonaSkuId: "",
});

export function ProductEditor({
  initial,
  categories,
}: {
  readonly initial: EditorProduct;
  readonly categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [p, setP] = useState<EditorProduct>(() => ({
    ...initial,
    variants: initial.variants.length ? initial.variants : [newVariant()],
  }));
  const [slugTouched, setSlugTouched] = useState(!initial.isNew);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof EditorProduct>(key: K, value: EditorProduct[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const setVariant = (key: string, patch: Partial<EditorVariant>) =>
    setP((prev) => ({ ...prev, variants: prev.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));

  const colors = useMemo(() => [...new Set(p.variants.map((v) => v.color.trim()).filter(Boolean))], [p.variants]);

  const save = () => {
    const variants: VariantPayload[] = [];
    for (const [i, v] of p.variants.entries()) {
      const price = parseBRLToCents(v.price);
      const compareAt = v.compareAt.trim() ? parseBRLToCents(v.compareAt) : null;
      const stock = Number.parseInt(v.stock, 10);
      if (price === null || price <= 0) return toast.error(`Variante ${i + 1}: preço inválido.`);
      if (v.compareAt.trim() && compareAt === null) return toast.error(`Variante ${i + 1}: preço "de" inválido.`);
      if (!Number.isInteger(stock) || stock < 0) return toast.error(`Variante ${i + 1}: estoque inválido.`);
      variants.push({
        id: v.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        priceCents: price,
        compareAtCents: compareAt,
        stock,
        isActive: v.isActive,
        dimonaSkuId: v.dimonaSkuId,
      });
    }
    startTransition(async () => {
      const result = await saveProduct({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        specs: p.specs.filter((s) => s.label.trim() && s.value.trim()),
        categoryId: p.categoryId || null,
        status: p.status,
        fulfillment: p.fulfillment,
        dimonaDesigns: p.dimonaDesigns,
        dimonaMocks: p.dimonaMocks,
        isFeatured: p.isFeatured,
        position: Number.parseInt(p.position, 10) || 0,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        variants,
        images: p.images.map((img) => ({
          storagePath: img.storagePath,
          alt: img.alt,
          color: img.color,
          width: img.width,
          height: img.height,
        })),
      });
      if (result.ok) {
        toast.success(result.message);
        if (initial.isNew) router.replace(`/admin/produtos/${p.id}`);
        else router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const remove = () => {
    if (!window.confirm("Excluir este produto? Se ele já tiver pedidos, será arquivado.")) return;
    startTransition(async () => {
      const result = await deleteProduct(p.id);
      if (result.ok) {
        toast.success(result.message);
        router.push("/admin/produtos");
      } else toast.error(result.message);
    });
  };

  return (
    <form
      className="grid gap-6 xl:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid content-start gap-6 xl:col-span-2">
        <Panel title="Informações">
          <div className="grid gap-5">
            <TextField
              label="Nome do produto"
              required
              value={p.name}
              maxLength={120}
              onChange={(e) => {
                const name = e.target.value;
                setP((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
              }}
            />
            <TextField
              label="Endereço (slug)"
              required
              value={p.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
              hint={`A página fica em /produto/${p.slug || "…"}`}
            />
            <TextAreaField label="Descrição" rows={6} maxLength={5000} value={p.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </Panel>

        <Panel
          title="Variantes (preço e estoque)"
          actions={
            <Button size="sm" variant="secondary" onClick={() => set("variants", [...p.variants, newVariant()])}>
              <Plus className="size-4" aria-hidden="true" /> Variante
            </Button>
          }
        >
          <p className="mb-4 text-xs text-muted">
            Uma linha por combinação de cor e tamanho. Deixe cor/tamanho em branco se o boné tiver modelo único. O estoque é
            baixado automaticamente a cada pedido e devolvido se o pagamento não acontecer.
          </p>
          <ul className="grid gap-4">
            {p.variants.map((v, i) => (
              <li key={v.key} className="grid gap-3 rounded-sm border border-line p-4 sm:grid-cols-6">
                <TextField label="Cor" value={v.color} onChange={(e) => setVariant(v.key, { color: e.target.value })} wrapperClassName="sm:col-span-2" placeholder="Ex.: Preto" />
                <TextField label="Tamanho" value={v.size} onChange={(e) => setVariant(v.key, { size: e.target.value })} wrapperClassName="sm:col-span-2" placeholder="Ex.: Único" />
                <TextField label="SKU" value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value })} wrapperClassName="sm:col-span-2" />
                <TextField label="Preço (R$)" required inputMode="decimal" value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value })} wrapperClassName="sm:col-span-2" placeholder="129,90" />
                <TextField label="Preço “de” (opcional)" inputMode="decimal" value={v.compareAt} onChange={(e) => setVariant(v.key, { compareAt: e.target.value })} wrapperClassName="sm:col-span-2" />
                <TextField label="Estoque" required type="number" min={0} inputMode="numeric" value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value })} wrapperClassName="sm:col-span-2" />
                {p.fulfillment === "dimona" ? (
                  <TextField label="SKU Dimona" value={v.dimonaSkuId} onChange={(e) => setVariant(v.key, { dimonaSkuId: e.target.value.trim() })}
                    wrapperClassName="sm:col-span-3" placeholder="Ex.: 010603110108" hint="Código do produto/cor/tamanho no catálogo da Dimona." />
                ) : null}
                <div className="flex items-center justify-between gap-3 sm:col-span-6">
                  <CheckboxField label="Variante ativa" checked={v.isActive} onChange={(e) => setVariant(v.key, { isActive: e.target.checked })} />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={p.variants.length === 1}
                    onClick={() => set("variants", p.variants.filter((x) => x.key !== v.key))}
                    aria-label={`Remover variante ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" /> Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Produção">
          <div className="grid gap-4">
            <SelectField label="Quem produz e envia" value={p.fulfillment} onChange={(e) => set("fulfillment", e.target.value as Fulfillment)}>
              <option value="stock">Estoque próprio (a loja separa e envia)</option>
              <option value="dimona">Dimona (impressão sob demanda)</option>
            </SelectField>
            {p.fulfillment === "dimona" ? (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Ao ser pago, o pedido é enviado à Dimona com o SKU de cada variante e os links abaixo (https, arquivo de
                  impressão em PNG). Como a produção é sob demanda, deixe um estoque alto (ex.: 999) nas variantes.
                </p>
                <DimonaFilesFields title="Artes de impressão" files={p.dimonaDesigns} onChange={(files) => set("dimonaDesigns", files)} />
                <DimonaFilesFields title="Mockups (opcional)" files={p.dimonaMocks} onChange={(files) => set("dimonaMocks", files)} />
              </>
            ) : null}
          </div>
        </Panel>

        <Panel title="Fotos">
          <ImageUploader productId={p.id} productName={p.name} images={p.images} colors={colors} onChange={(images) => set("images", images)} />
        </Panel>

        <Panel
          title="Ficha técnica"
          actions={
            <Button size="sm" variant="secondary" onClick={() => set("specs", [...p.specs, { label: "", value: "" }])} disabled={p.specs.length >= 12}>
              <Plus className="size-4" aria-hidden="true" /> Item
            </Button>
          }
        >
          {p.specs.length === 0 ? (
            <p className="text-sm text-muted">Ex.: Material — 100% algodão · Fecho — ajustável com fivela.</p>
          ) : (
            <ul className="grid gap-3">
              {p.specs.map((s, i) => (
                <li key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <TextField label="Rótulo" value={s.label} maxLength={40} onChange={(e) => set("specs", p.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <TextField label="Valor" value={s.value} maxLength={200} onChange={(e) => set("specs", p.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <Button size="md" variant="ghost" onClick={() => set("specs", p.specs.filter((_, j) => j !== i))} aria-label="Remover item">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid content-start gap-6">
        <Panel title="Publicação">
          <div className="grid gap-4">
            <SelectField label="Status" value={p.status} onChange={(e) => set("status", e.target.value as ProductStatus)}>
              <option value="draft">Rascunho (não aparece na loja)</option>
              <option value="active">Publicado</option>
              <option value="archived">Arquivado</option>
            </SelectField>
            <SelectField label="Categoria" value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <TextField label="Posição na vitrine" type="number" min={0} value={p.position} onChange={(e) => set("position", e.target.value)} hint="Menor número aparece primeiro." />
            <CheckboxField label="Destaque (aparece na fileira da página inicial)" checked={p.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
            <Button type="submit" size="lg" loading={pending}>
              Salvar produto
            </Button>
            {!initial.isNew ? (
              <Button variant="ghost" onClick={remove} disabled={pending}>
                Excluir produto
              </Button>
            ) : null}
          </div>
        </Panel>
        <Panel title="SEO (opcional)">
          <div className="grid gap-4">
            <TextField label="Título para buscadores" maxLength={70} value={p.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
            <TextAreaField label="Descrição para buscadores" maxLength={160} rows={3} value={p.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
          </div>
        </Panel>
      </div>
    </form>
  );
}

function DimonaFilesFields({
  title,
  files,
  onChange,
}: {
  readonly title: string;
  readonly files: EditorDimonaFiles;
  readonly onChange: (files: EditorDimonaFiles) => void;
}) {
  return (
    <fieldset className="grid gap-3 rounded-sm border border-line p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {DIMONA_SIDES.map((side) => (
          <TextField
            key={side.value}
            label={side.label}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={files[side.value]}
            onChange={(e) => onChange({ ...files, [side.value]: e.target.value })}
          />
        ))}
      </div>
    </fieldset>
  );
}
