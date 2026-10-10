// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCategory, saveCategory } from "@/app/admin/actions/catalog";
import { Button } from "@/components/ui/Button";
import { CheckboxField, TextField } from "@/components/ui/Field";
import { slugify } from "@/lib/validation";

interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
}

function CategoryRowForm({ category, onDone }: { readonly category?: Category; readonly onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [position, setPosition] = useState(String(category?.position ?? 0));
  const [active, setActive] = useState(category?.is_active ?? true);
  const [touched, setTouched] = useState(Boolean(category));
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid items-end gap-3 rounded-sm border border-line bg-paper p-4 md:grid-cols-[2fr_2fr_1fr_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveCategory({ id: category?.id, name, slug, position: Number.parseInt(position, 10) || 0, isActive: active });
          if (r.ok) {
            toast.success(r.message);
            if (!category) {
              setName("");
              setSlug("");
              setTouched(false);
            }
            onDone();
          } else toast.error(r.message);
        });
      }}
    >
      <TextField label="Nome" value={name} required onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
      <TextField label="Slug" value={slug} required onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} />
      <TextField label="Posição" type="number" min={0} value={position} onChange={(e) => setPosition(e.target.value)} />
      <CheckboxField label="Ativa" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{category ? "Salvar" : "Criar"}</Button>
        {category ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Excluir a categoria “${category.name}”? Os produtos ficarão sem categoria.`)) return;
              startTransition(async () => {
                const r = await deleteCategory(category.id);
                if (r.ok) { toast.success(r.message); onDone(); } else toast.error(r.message);
              });
            }}
          >
            Excluir
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { readonly categories: Category[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  return (
    <div className="grid gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Nova categoria</h2>
        <CategoryRowForm onDone={refresh} />
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">Categorias ({categories.length})</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma categoria ainda. Elas são opcionais e servem como filtro na loja (ex.: Trucker, Dad hat).</p>
        ) : (
          <ul className="grid gap-3">
            {categories.map((c) => (
              <li key={c.id}>
                <CategoryRowForm category={c} onDone={refresh} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
