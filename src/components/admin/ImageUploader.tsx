// Hello World
"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getBrowserDb } from "@/lib/supabase/browser";
import { PRODUCT_IMAGES_BUCKET, productImageUrl } from "@/lib/storage";
import type { EditorImage } from "@/components/admin/product-editor-model";


const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 2000;

/** Reduz para no máximo 2000px e converte para WebP no navegador (fotos leves na loja). */
async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
  if (!blob) throw new Error("Falha ao converter a imagem");
  return { blob, width, height };
}

export function ImageUploader({
  productId,
  productName,
  images,
  colors,
  onChange,
}: {
  readonly productId: string;
  readonly productName: string;
  readonly images: EditorImage[];
  readonly colors: string[];
  readonly onChange: (images: EditorImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 12 - images.length);
    if (list.length === 0) {
      toast.error("Limite de 12 fotos por produto.");
      return;
    }
    setUploading(list.length);
    const db = getBrowserDb();
    const added: EditorImage[] = [];
    for (const file of list) {
      try {
        if (!ACCEPTED.includes(file.type)) throw new Error(`${file.name}: use JPG, PNG, WebP ou AVIF.`);
        if (file.size > MAX_INPUT_BYTES) throw new Error(`${file.name}: arquivo maior que 15 MB.`);
        const { blob, width, height } = await toWebp(file);
        const path = `products/${productId}/${crypto.randomUUID()}.webp`;
        const { error } = await db.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, blob, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
        if (error) throw new Error(`${file.name}: ${error.message}`);
        added.push({ storagePath: path, alt: productName, color: "", width, height });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha no envio da foto.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (added.length) onChange([...images, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const move = (index: number, delta: number) => {
    const next = images.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    onChange(next);
  };

  const update = (index: number, patch: Partial<EditorImage>) =>
    onChange(images.map((img, i) => (i === index ? { ...img, ...patch } : img)));

  return (
    <div>
      {images.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((img, i) => {
            const url = productImageUrl(img.storagePath);
            return (
              <li key={img.storagePath} className="rounded-sm border border-line bg-paper p-3">
                <div className="relative aspect-square overflow-hidden rounded-xs bg-cream">
                  {url ? <Image src={url} alt={img.alt} fill sizes="240px" className="object-contain p-2" /> : null}
                  {i === 0 ? <span className="absolute top-2 left-2 rounded-xs bg-ink px-2 py-0.5 text-xs text-paper">Principal</span> : null}
                </div>
                <label className="mt-3 block text-xs text-muted">
                  Descrição da foto (acessibilidade)
                  <input
                    value={img.alt}
                    onChange={(e) => update(i, { alt: e.target.value.slice(0, 160) })}
                    className="mt-1 min-h-10 w-full rounded-sm border border-line-strong px-2 text-sm text-ink"
                  />
                </label>
                {colors.length > 0 ? (
                  <label className="mt-2 block text-xs text-muted">
                    Cor da variante
                    <select
                      value={img.color}
                      onChange={(e) => update(i, { color: e.target.value })}
                      className="mt-1 min-h-10 w-full rounded-sm border border-line-strong bg-paper px-2 text-sm text-ink"
                    >
                      <option value="">Todas as cores</option>
                      {colors.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="mt-2 flex justify-between">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-10 place-items-center rounded-sm hover:bg-cream disabled:opacity-30" aria-label="Mover para antes">
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="grid size-10 place-items-center rounded-sm hover:bg-cream disabled:opacity-30" aria-label="Mover para depois">
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                    className="grid size-10 place-items-center rounded-sm text-danger hover:bg-[#fbeeed]"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        id="product-images"
        onChange={(e) => void upload(e.target.files)}
      />
      <label
        htmlFor="product-images"
        className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong bg-paper px-4 py-6 text-center text-sm text-ink-soft hover:border-ink"
      >
        <ImagePlus className="size-5" aria-hidden="true" />
        {uploading > 0 ? `Enviando ${uploading} foto(s)…` : "Adicionar fotos oficiais (JPG, PNG, WebP · até 12)"}
        <span className="text-xs text-muted">A primeira foto é a principal. Convertidas para WebP até 2000px.</span>
      </label>
      <p className="mt-2 text-xs text-muted">
        Fotos removidas daqui são apagadas do armazenamento ao salvar o produto.
      </p>
    </div>
  );
}
