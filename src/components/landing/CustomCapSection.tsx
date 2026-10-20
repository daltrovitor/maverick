// Hello World
"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { AnimatePresence, m } from "motion/react";
import { Minus, Plus, Upload } from "lucide-react";
import { startDesignUpload, submitCustomRequest } from "@/app/(site)/custom-actions";
import { Button } from "@/components/ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { KineticHeading } from "@/components/ui/KineticHeading";
import { formatBRL } from "@/lib/br";
import { clampQuantity, discountTiers, formatBps, quoteCustom, type CustomPricing } from "@/lib/custom-pricing";
import { CUSTOM_DESIGNS_BUCKET } from "@/lib/storage";
import { getBrowserDb } from "@/lib/supabase/browser";
import { CAP_MODELS, CAP_TECHNIQUES, DESIGN_MAX_BYTES, DESIGN_MIMES } from "@/lib/validation";

type DesignMime = (typeof DESIGN_MIMES)[number];

const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

const EXTENSION_MIME: Record<string, DesignMime> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

/** Tipo do arquivo pelo navegador ou, se vier vazio, pela extensão. */
function mimeOf(file: File): DesignMime | null {
  const declared = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if ((DESIGN_MIMES as readonly string[]).includes(declared)) return declared as DesignMime;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? null;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  capModel: string;
  capColor: string;
  technique: string;
  notes: string;
  consent: boolean;
}

type Busy = null | "upload" | "save";
type Done = { number: number; estimatedTotalCents: number | null; discountBps: number; quantity: number };

/**
 * Boné personalizado: o cliente envia a arte, escolhe modelo e quantidade e vê na hora o
 * preço com desconto progressivo (configurado no painel). O pedido chega à equipe por
 * e-mail e no painel; o orçamento final é confirmado pelo WhatsApp.
 */
export function CustomCapSection({ pricing }: { readonly pricing: CustomPricing }) {
  const formId = useId();
  const [quantityText, setQuantityText] = useState(String(Math.max(pricing.minQuantity, Math.min(pricing.stepUnits, pricing.maxQuantity))));
  const quantity = clampQuantity(Number.parseInt(quantityText, 10) || pricing.minQuantity, pricing);
  const quote = useMemo(() => quoteCustom(quantity, pricing), [quantity, pricing]);
  const tiers = useMemo(() => discountTiers(pricing), [pricing]);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    capModel: "",
    capColor: "",
    technique: "",
    notes: "",
    consent: false,
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const [file, setFile] = useState<{ file: File; mime: DesignMime } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prévia local da imagem (o arquivo não sai do navegador antes do envio).
  const preview = useMemo(() => (file && file.mime !== "application/pdf" ? URL.createObjectURL(file.file) : null), [file]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    const mime = mimeOf(picked);
    if (!mime) {
      setError({ message: "Envie a arte em PNG, JPG, WEBP ou PDF.", field: "design" });
      return;
    }
    if (picked.size > DESIGN_MAX_BYTES) {
      setError({ message: "A arte deve ter no máximo 10 MB.", field: "design" });
      return;
    }
    setError(null);
    setFile({ file: picked, mime });
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files[0]);
  };

  const fail = (message: string, field?: string) => {
    setError({ message, field });
    setBusy(null);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (!file) return fail("Envie a arte do seu boné.", "design");
    if (!form.capModel) return fail("Escolha o modelo do boné.", "capModel");
    if (!form.technique) return fail("Escolha a técnica de aplicação.", "technique");
    if (!form.consent) return fail("É preciso aceitar o tratamento dos dados.", "privacyConsent");

    setBusy("upload");
    const start = await startDesignUpload({ fileName: file.file.name, mime: file.mime, size: file.file.size });
    if (!start.ok) return fail(start.message, "design");
    try {
      const { error: uploadError } = await getBrowserDb()
        .storage.from(CUSTOM_DESIGNS_BUCKET)
        .uploadToSignedUrl(start.path, start.token, file.file, { contentType: file.mime });
      if (uploadError) return fail("Não foi possível enviar a arte. Confira a conexão e tente de novo.", "design");
    } catch {
      return fail("Não foi possível enviar a arte agora. Tente novamente em instantes.", "design");
    }

    setBusy("save");
    const result = await submitCustomRequest({
      name: form.name,
      email: form.email,
      phone: form.phone,
      quantity,
      capModel: form.capModel,
      capColor: form.capColor,
      technique: form.technique,
      notes: form.notes,
      design: { path: start.path, mime: file.mime, size: file.file.size },
      privacyConsent: form.consent,
    });
    if (!result.ok) return fail(result.message, result.field);
    setBusy(null);
    setDone({ number: result.number, estimatedTotalCents: result.estimatedTotalCents, discountBps: result.discountBps, quantity });
  };

  const fieldError = (name: string) => (error?.field === name ? error.message : null);

  return (
    <section id="personalizado" aria-labelledby="personalizado-title" className="border-b border-line bg-paper py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <KineticHeading
            id="personalizado-title"
            text="Crie seu boné."
            className="type-monument text-[clamp(2.8rem,9vw,7.5rem)] text-ink lg:col-span-8"
          />
          <p className="max-w-sm leading-relaxed text-ink-soft lg:col-span-4 lg:justify-self-end">
            Envie sua arte, escolha o modelo e a quantidade. Quanto mais bonés, maior o desconto em todos eles. O orçamento
            final chega pelo WhatsApp.
          </p>
        </div>

        {done ? (
          <div role="status" className="mt-16 rounded-xs border border-line bg-cream px-6 py-14 sm:px-12">
            <p className="type-micro text-gold-ink">Pedido nº {done.number}</p>
            <h3 className="type-brand mt-4 text-2xl sm:text-3xl">Recebemos sua arte.</h3>
            <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
              {done.estimatedTotalCents !== null
                ? `Estimativa para ${done.quantity} bonés: ${formatBRL(done.estimatedTotalCents)}${
                    done.discountBps > 0 ? ` (com ${formatBps(done.discountBps)} de desconto)` : ""
                  }. `
                : `Pedido de ${done.quantity} bonés registrado. `}
              Nossa equipe confere a arte e responde pelo WhatsApp com o orçamento final e o prazo.
            </p>
            <Button
              variant="secondary"
              className="mt-8"
              onClick={() => {
                setDone(null);
                setFile(null);
                setForm((f) => ({ ...f, notes: "", consent: false }));
              }}
            >
              Enviar outro pedido
            </Button>
          </div>
        ) : (
          <form id={formId} onSubmit={submit} noValidate className="mt-16 grid gap-12 lg:grid-cols-12">
            <aside aria-label="Calculadora de preço" className="lg:order-last lg:col-span-5">
              <div className="rounded-xs border border-line bg-cream p-6 sm:p-8 lg:sticky lg:top-28">
                <h3 className="type-micro text-ink-soft">Calculadora</h3>

                <label htmlFor={`${formId}-qty`} className="mt-6 block text-sm font-medium">
                  Quantidade de bonés
                </label>
                <div className="mt-2 flex items-stretch gap-2">
                  <Button
                    variant="secondary"
                    aria-label="Diminuir quantidade"
                    className="w-12 shrink-0 px-0!"
                    disabled={quantity <= pricing.minQuantity}
                    onClick={() => setQuantityText(String(clampQuantity(quantity - 1, pricing)))}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </Button>
                  <input
                    id={`${formId}-qty`}
                    inputMode="numeric"
                    value={quantityText}
                    onChange={(e) => setQuantityText(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onBlur={() => setQuantityText(String(quantity))}
                    aria-describedby={`${formId}-qty-hint`}
                    className="tabular min-h-12 w-full min-w-0 rounded-sm border border-line-strong bg-paper px-3 text-center text-lg font-semibold focus:border-ink focus:outline-none"
                  />
                  <Button
                    variant="secondary"
                    aria-label="Aumentar quantidade"
                    className="w-12 shrink-0 px-0!"
                    disabled={quantity >= pricing.maxQuantity}
                    onClick={() => setQuantityText(String(clampQuantity(quantity + 1, pricing)))}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <input
                  type="range"
                  min={pricing.minQuantity}
                  max={pricing.maxQuantity}
                  value={quantity}
                  onChange={(e) => setQuantityText(e.target.value)}
                  aria-label="Quantidade de bonés"
                  className="mt-4 h-12 w-full cursor-pointer accent-ink"
                />
                <p id={`${formId}-qty-hint`} className="text-xs text-muted">
                  De {pricing.minQuantity} a {pricing.maxQuantity.toLocaleString("pt-BR")} unidades por pedido.
                </p>

                <dl className="mt-8 grid gap-3 border-t border-line pt-6 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-soft">Preço por boné</dt>
                    <dd className="tabular text-right">
                      {quote.unitCents === null ? (
                        "Sob consulta"
                      ) : (
                        <>
                          {quote.discountBps > 0 && pricing.unitPriceCents ? (
                            <s className="mr-2 text-muted">{formatBRL(pricing.unitPriceCents)}</s>
                          ) : null}
                          {formatBRL(quote.unitCents)}
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-soft">Desconto em todas as unidades</dt>
                    <dd className="tabular">{quote.discountBps > 0 ? formatBps(quote.discountBps) : "—"}</dd>
                  </div>
                  {quote.savingsCents ? (
                    <div className="flex items-baseline justify-between gap-4 text-success">
                      <dt>Você economiza</dt>
                      <dd className="tabular">{formatBRL(quote.savingsCents)}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-6 border-t border-line pt-6">
                  <p className="text-sm text-ink-soft">Total estimado</p>
                  <p className="tabular mt-1 overflow-hidden text-[clamp(2.25rem,5vw,3.25rem)] leading-none font-semibold" aria-live="polite">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.span
                        key={quote.totalCents ?? "consulta"}
                        className="inline-block"
                        initial={{ y: "70%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "-70%", opacity: 0 }}
                        transition={SPRING}
                      >
                        {quote.totalCents === null ? "Sob consulta" : formatBRL(quote.totalCents)}
                      </m.span>
                    </AnimatePresence>
                  </p>
                  {quote.next ? (
                    <p className="mt-3 text-xs leading-relaxed text-gold-ink">
                      Com {quote.next.quantity} bonés ({quote.next.quantity - quantity} a mais), o desconto sobe para{" "}
                      {formatBps(quote.next.discountBps)} em todos.
                    </p>
                  ) : null}
                </div>

                {tiers.length > 0 ? (
                  <div className="mt-6">
                    <p className="text-xs text-muted">Faixas de desconto · toque para simular</p>
                    <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                      {tiers.map((tier) => {
                        const active = quote.discountBps === tier.discountBps;
                        return (
                          <li key={tier.quantity}>
                            <button
                              type="button"
                              onClick={() => setQuantityText(String(tier.quantity))}
                              aria-pressed={active}
                              className={`relative flex min-h-12 w-full flex-col items-start justify-center rounded-xs border px-3 text-left text-xs transition-colors ${
                                active ? "border-ink text-paper" : "border-line-strong text-ink-soft hover:border-ink"
                              }`}
                            >
                              {active ? (
                                <m.span layoutId="custom-tier" transition={SPRING} className="absolute inset-0 -z-0 rounded-xs bg-ink" aria-hidden="true" />
                              ) : null}
                              <span className="tabular relative font-medium">{tier.quantity}+ un.</span>
                              <span className="tabular relative">−{formatBps(tier.discountBps)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </aside>

            <div className="grid content-start gap-12 lg:col-span-7">
              {error ? (
                <div
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  className="rounded-xs border border-danger/30 bg-[#fbeeed] px-4 py-3 text-sm text-danger"
                >
                  {error.message}
                </div>
              ) : null}

              <fieldset className="grid gap-4">
                <legend className="type-micro mb-2 text-ink-soft">01 · Sua arte</legend>
                <input
                  ref={fileInputRef}
                  id={`${formId}-design`}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                  className="peer sr-only"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  aria-invalid={fieldError("design") ? true : undefined}
                  aria-describedby={`${formId}-design-hint`}
                />
                <label
                  htmlFor={`${formId}-design`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`flex min-h-44 flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-6 py-8 text-center transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-ink ${
                    dragging ? "border-ink bg-cream" : fieldError("design") ? "border-danger" : "border-line-strong hover:border-ink"
                  }`}
                >
                  {file ? (
                    <span className="flex w-full items-center gap-4 text-left">
                      <span className="relative size-20 shrink-0 overflow-hidden rounded-xs border border-line bg-cream">
                        {preview ? (
                          <Image src={preview} alt="Prévia da arte" fill sizes="80px" className="object-contain p-1" unoptimized />
                        ) : (
                          <span className="type-micro absolute inset-0 grid place-items-center text-ink-soft">PDF</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{file.file.name}</span>
                        <span className="block text-xs text-muted">{formatBytes(file.file.size)} · toque para trocar</span>
                      </span>
                    </span>
                  ) : (
                    <>
                      <Upload className="size-6 text-ink-soft" aria-hidden="true" />
                      <span className="font-medium">Arraste a arte aqui ou escolha um arquivo</span>
                    </>
                  )}
                </label>
                <p id={`${formId}-design-hint`} className="text-xs text-muted">
                  PNG, JPG, WEBP ou PDF, até 10 MB. Prefira fundo transparente e boa resolução.
                </p>
              </fieldset>

              <fieldset className="grid gap-5">
                <legend className="type-micro mb-2 text-ink-soft">02 · O boné</legend>
                <SelectField
                  label="Modelo"
                  required
                  value={form.capModel}
                  onChange={(e) => set("capModel", e.target.value)}
                  error={fieldError("capModel")}
                >
                  <option value="">Selecione</option>
                  {CAP_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </SelectField>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    label="Cor do boné"
                    maxLength={60}
                    placeholder="Ex.: preto com aba bege"
                    value={form.capColor}
                    onChange={(e) => set("capColor", e.target.value)}
                  />
                  <SelectField
                    label="Técnica"
                    required
                    value={form.technique}
                    onChange={(e) => set("technique", e.target.value)}
                    error={fieldError("technique")}
                  >
                    <option value="">Selecione</option>
                    {CAP_TECHNIQUES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <TextAreaField
                  label="Detalhes (opcional)"
                  rows={3}
                  maxLength={2000}
                  placeholder="Posição da arte, cores da linha, prazo desejado…"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </fieldset>

              <fieldset className="grid gap-5">
                <legend className="type-micro mb-2 text-ink-soft">03 · Contato</legend>
                <TextField
                  label="Nome completo"
                  autoComplete="name"
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  error={fieldError("name")}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    label="E-mail"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    error={fieldError("email")}
                  />
                  <TextField
                    label="WhatsApp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    placeholder="(62) 99999-0000"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    error={fieldError("phone")}
                  />
                </div>
                <CheckboxField
                  label="Autorizo o uso dos meus dados e da arte enviada somente para orçar e produzir este pedido."
                  checked={form.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  error={fieldError("privacyConsent")}
                />
              </fieldset>

              <div>
                <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy !== null}>
                  {busy === "upload" ? "Enviando a arte…" : busy === "save" ? "Registrando o pedido…" : "Enviar pedido personalizado"}
                </Button>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Sem pagamento agora: a equipe confere a arte e envia o orçamento final antes da produção.
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
