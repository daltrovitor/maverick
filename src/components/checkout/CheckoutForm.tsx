// Hello World
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { CreditCard, QrCode } from "lucide-react";
import { formatBRL, formatCep, formatCpf, isUf, onlyDigits, UFS } from "@/lib/br";
import { placeOrder, quoteCheckout, type QuoteResult } from "@/app/(site)/checkout/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { useCart } from "@/components/cart/CartProvider";
import { clearStoredCoupon, readStoredCoupon } from "@/components/cart/CouponCapture";
import { useDelivery } from "@/components/delivery/DeliveryProvider";
import { useRegionalPrice } from "@/components/delivery/StorePrice";

interface Props {
  readonly pixAvailable: boolean;
  /** Pix pelo Stripe: QR Code com confirmação automática (senão, conferência manual). */
  readonly pixAutomatic: boolean;
  readonly cardAvailable: boolean;
  readonly pixHours: number;
  readonly prefill: { name: string; email: string; phone: string };
}

type Method = "pix" | "card";

/** O cupom guardado só muda por ação desta própria aba; não há o que assinar. */
const subscribeNothing = () => () => {};

interface FormState {
  name: string;
  email: string;
  phone: string;
  document: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
  notes: string;
}

export function CheckoutForm({ pixAvailable, pixAutomatic, cardAvailable, pixHours, prefill }: Props) {
  const router = useRouter();
  const { lines, ready, clear, notice } = useCart();
  const { pricing, delivery, hydrated, setDelivery } = useDelivery();
  const regional = useRegionalPrice();
  const shippingInPrice = pricing.inPrice && pricing.rates.length > 0;
  const [form, setForm] = useState<FormState>({
    name: prefill.name,
    email: prefill.email,
    phone: prefill.phone ? prefill.phone.replace(/^55/, "") : "",
    document: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    uf: "",
    notes: "",
  });
  const [method, setMethod] = useState<Method | null>(pixAvailable ? "pix" : cardAvailable ? "card" : null);
  // Código vindo de link de afiliado (?cupom=): pré-preenche; o banco decide se ainda vale.
  const storedCoupon = useSyncExternalStore(subscribeNothing, readStoredCoupon, () => "");
  const [typedCoupon, setTypedCoupon] = useState<string | null>(null);
  const couponInput = typedCoupon ?? storedCoupon;
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [lastQuote, setLastQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [settledQuoteKey, setSettledQuoteKey] = useState<string | null>(null);
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [formError, setFormError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const numberRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const prefilledCep = useRef(false);

  const items = useMemo(() => lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [lines]);

  // Cotação: só existe com sacola, UF e carrinho hidratado; "calculando" enquanto a resposta
  // para a combinação atual (sacola, UF, cupom, e-mail) não chegou.
  const quoteKey =
    ready && items.length > 0 && form.uf ? JSON.stringify([items, form.uf, appliedCoupon, form.email]) : null;
  const quote = quoteKey ? lastQuote : null;
  const quoting = quoteKey !== null && settledQuoteKey !== quoteKey;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Autopreenchimento pelo CEP (ViaCEP).
  const lookupCep = useCallback(async (raw: string, focusNumber = true) => {
    const cep = onlyDigits(raw);
    if (cep.length !== 8) return;
    setCepStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        setCepStatus("not_found");
        return;
      }
      setForm((f) => ({
        ...f,
        street: data.logradouro || f.street,
        district: data.bairro || f.district,
        city: data.localidade || f.city,
        uf: data.uf || f.uf,
      }));
      setCepStatus("found");
      // O CEP do checkout passa a ser o destino da loja inteira (preços com o frete da região).
      if (data.uf && isUf(data.uf)) setDelivery({ cep, uf: data.uf, city: data.localidade ?? null });
      if (focusNumber) numberRef.current?.focus();
    } catch {
      // Sem ViaCEP: o cliente preenche manualmente; o servidor confere de novo.
      setCepStatus("idle");
    }
  }, [setDelivery]);

  // CEP já informado na loja: preenche o endereço sozinho (uma vez, depois de hidratar).
  useEffect(() => {
    if (!hydrated || prefilledCep.current || !delivery) return;
    const timer = window.setTimeout(() => {
      prefilledCep.current = true;
      setForm((f) => (f.cep ? f : { ...f, cep: formatCep(delivery.cep) }));
      void lookupCep(delivery.cep, false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, delivery, lookupCep]);

  // Recalcula frete/desconto/total no servidor sempre que sacola, UF ou cupom mudam.
  useEffect(() => {
    if (!quoteKey) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await quoteCheckout({
        items,
        uf: form.uf,
        couponCode: appliedCoupon ?? undefined,
        email: form.email || undefined,
      });
      if (cancelled) return;
      setSettledQuoteKey(quoteKey);
      if (result.ok) {
        setLastQuote(result);
        setQuoteError(null);
      } else if (result.field === "coupon") {
        setCouponError(result.message);
        setAppliedCoupon(null);
      } else {
        setLastQuote(null);
        setQuoteError(result.message);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [quoteKey, items, form.uf, appliedCoupon, form.email]);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    setCouponError(null);
    if (!code) return;
    if (!form.uf) {
      setCouponError("Informe o CEP/estado de entrega para aplicar o cupom.");
      return;
    }
    setAppliedCoupon(code);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!method) {
      setFormError({ message: "Nenhuma forma de pagamento disponível no momento." });
      return;
    }
    startTransition(async () => {
      const result = await placeOrder({
        idempotencyKey,
        paymentMethod: method,
        customer: { name: form.name, email: form.email, phone: form.phone, document: form.document },
        address: {
          cep: form.cep,
          street: form.street,
          number: form.number,
          complement: form.complement,
          district: form.district,
          city: form.city,
          uf: form.uf,
        },
        items,
        couponCode: appliedCoupon ?? undefined,
        notes: form.notes || undefined,
      });
      if (!result.ok) {
        setFormError({ message: result.message, field: result.field });
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      clear();
      clearStoredCoupon();
      router.push(result.redirectTo);
    });
  };

  if (ready && lines.length === 0 && !pending) {
    return (
      <div className="mt-10 rounded-xs border border-line bg-cream px-6 py-16 text-center">
        <p className="text-ink-soft">Sua sacola está vazia.</p>
        <ButtonLink href="/loja" variant="secondary" className="mt-6">
          Explorar a coleção
        </ButtonLink>
      </div>
    );
  }

  const fieldError = (name: string) => (formError?.field === name ? formError.message : null);
  const shipping = quote?.shippingCents;
  const localSubtotal = lines.reduce((sum, l) => sum + regional(l.unitPriceCents, form.uf || null) * l.quantity, 0);
  const total = quote?.totalCents;

  return (
    <form onSubmit={submit} className="mt-10 grid gap-12 lg:grid-cols-12" noValidate>
      <div className="grid gap-12 lg:col-span-7">
        {formError ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xs border border-danger/30 bg-[#fbeeed] px-4 py-3 text-sm text-danger"
          >
            {formError.message}
          </div>
        ) : null}

        <fieldset className="grid gap-5">
          <legend className="type-micro mb-2 text-ink-soft">01 · Contato</legend>
          <TextField label="Nome completo" name="name" autoComplete="name" required value={form.name}
            onChange={(e) => set("name", e.target.value)} error={fieldError("customer.name")} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="E-mail" name="email" type="email" autoComplete="email" required value={form.email}
              onChange={(e) => set("email", e.target.value)} error={fieldError("customer.email")}
              hint="Usado para identificar seu pedido e falar com você." />
            <TextField label="WhatsApp" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" required
              placeholder="(62) 99999-0000" value={form.phone} onChange={(e) => set("phone", e.target.value)}
              error={fieldError("customer.phone")} />
          </div>
          <TextField label="CPF" name="document" inputMode="numeric" required placeholder="000.000.000-00"
            maxLength={14} value={form.document} wrapperClassName="sm:max-w-[calc(50%-0.625rem)]"
            onChange={(e) => set("document", formatCpf(e.target.value))} error={fieldError("customer.document")}
            hint="Exigido para a nota fiscal e o envio." />
        </fieldset>

        <fieldset className="grid gap-5">
          <legend className="type-micro mb-2 text-ink-soft">02 · Entrega</legend>
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField label="CEP" name="cep" inputMode="numeric" autoComplete="postal-code" required
              placeholder="00000-000" value={form.cep} maxLength={9}
              onChange={(e) => {
                const v = formatCep(onlyDigits(e.target.value).slice(0, 8));
                set("cep", v);
                if (onlyDigits(v).length === 8) void lookupCep(v);
              }}
              error={fieldError("address.cep") ?? (cepStatus === "not_found" ? "CEP não encontrado." : null)}
              hint={cepStatus === "loading" ? "Buscando endereço…" : undefined} />
            <TextField label="Rua" name="street" autoComplete="address-line1" required wrapperClassName="sm:col-span-2"
              value={form.street} onChange={(e) => set("street", e.target.value)} error={fieldError("address.street")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField ref={numberRef} label="Número" name="number" required value={form.number}
              onChange={(e) => set("number", e.target.value)} error={fieldError("address.number")} />
            <TextField label="Complemento" name="complement" autoComplete="address-line2" wrapperClassName="sm:col-span-2"
              value={form.complement} onChange={(e) => set("complement", e.target.value)} />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField label="Bairro" name="district" required value={form.district}
              onChange={(e) => set("district", e.target.value)} error={fieldError("address.district")} />
            <TextField label="Cidade" name="city" autoComplete="address-level2" required value={form.city}
              onChange={(e) => set("city", e.target.value)} error={fieldError("address.city")} />
            <SelectField label="Estado" name="uf" autoComplete="address-level1" required value={form.uf}
              onChange={(e) => set("uf", e.target.value)} error={fieldError("address.uf")}>
              <option value="">Selecione</option>
              {UFS.map((u) => (
                <option key={u.uf} value={u.uf}>
                  {u.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextAreaField label="Observações para a entrega (opcional)" name="notes" maxLength={500} rows={3}
            value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </fieldset>

        <fieldset>
          <legend className="type-micro mb-4 text-ink-soft">03 · Pagamento</legend>
          {!pixAvailable && !cardAvailable ? (
            <p className="rounded-xs border border-line bg-cream px-4 py-3 text-sm text-ink-soft">
              Os pagamentos estão temporariamente indisponíveis. Tente novamente em instantes.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Forma de pagamento">
              <PaymentOption
                value="pix"
                current={method}
                onSelect={setMethod}
                disabled={!pixAvailable}
                icon={<QrCode className="size-5" aria-hidden="true" />}
                title="Pix"
                description={
                  !pixAvailable
                    ? "Indisponível no momento."
                    : pixAutomatic
                      ? "QR Code no valor exato, gerado na hora. A confirmação é automática."
                      : `QR Code e copia-e-cola. Confirmamos o recebimento manualmente; o pedido fica reservado por ${pixHours}h.`
                }
              />
              <PaymentOption
                value="card"
                current={method}
                onSelect={setMethod}
                disabled={!cardAvailable}
                icon={<CreditCard className="size-5" aria-hidden="true" />}
                title="Cartão de crédito ou débito"
                description={
                  cardAvailable
                    ? "Pague aqui mesmo no site, em ambiente seguro do Stripe. Os dados do cartão não passam pela loja."
                    : "Indisponível no momento."
                }
              />
            </div>
          )}
        </fieldset>
      </div>

      <aside className="lg:col-span-5" aria-label="Resumo do pedido">
        <div className="rounded-xs border border-line bg-cream p-6 lg:sticky lg:top-28">
          <h2 className="type-micro text-ink-soft">Resumo</h2>
          {notice ? <p className="mt-3 text-xs text-gold-ink" role="status">{notice}</p> : null}
          <ul className="mt-4 divide-y divide-line">
            {lines.map((l) => (
              <li key={l.variantId} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xs bg-paper">
                  {l.imageUrl ? <Image src={l.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" /> : null}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-muted">
                    {l.quantity}× {l.variantLabel ?? ""}
                  </p>
                </div>
                <p className="tabular text-sm">{formatBRL(regional(l.unitPriceCents, form.uf || null) * l.quantity)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <label htmlFor="coupon" className="sr-only">
              Cupom de desconto
            </label>
            <input
              id="coupon"
              value={couponInput}
              onChange={(e) => setTypedCoupon(e.target.value.toUpperCase())}
              placeholder="Cupom de desconto"
              className="min-h-12 w-full rounded-sm border border-line-strong bg-paper px-3 text-sm uppercase placeholder:normal-case"
              aria-invalid={couponError ? true : undefined}
              aria-describedby={couponError ? "coupon-error" : undefined}
            />
            <Button variant="secondary" onClick={applyCoupon} disabled={!couponInput.trim()}>
              Aplicar
            </Button>
          </div>
          {couponError ? (
            <p id="coupon-error" role="alert" className="mt-2 text-xs text-danger">
              {couponError}
            </p>
          ) : quote?.couponCode ? (
            <p className="mt-2 text-xs text-success">
              Cupom {quote.couponCode} aplicado.{" "}
              <button type="button" className="underline" onClick={() => { setAppliedCoupon(null); setTypedCoupon(""); }}>
                Remover
              </button>
            </p>
          ) : null}

          <dl className="mt-6 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="tabular">{formatBRL(quote?.subtotalCents ?? localSubtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Frete</dt>
              <dd className="tabular">
                {shippingInPrice && !quoteError
                  ? "Grátis"
                  : !form.uf
                    ? "Informe o CEP"
                    : quoting
                      ? "Calculando…"
                      : shipping === undefined
                        ? "—"
                        : shipping === 0
                          ? "Grátis"
                          : formatBRL(shipping)}
              </dd>
            </div>
            {shippingInPrice ? <p className="text-right text-xs text-muted">O envio já está incluso no preço dos produtos.</p> : null}
            {quote?.shippingEstimate ? (
              <p className="text-right text-xs text-muted">Prazo estimado: {quote.shippingEstimate}</p>
            ) : null}
            {quote && quote.discountCents > 0 ? (
              <div className="flex justify-between text-success">
                <dt>Desconto</dt>
                <dd className="tabular">− {formatBRL(quote.discountCents)}</dd>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-line pt-4 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{total !== undefined ? formatBRL(total) : "—"}</dd>
            </div>
          </dl>
          {quoteError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {quoteError}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full"
            loading={pending}
            disabled={!quote || quoting || !method || lines.length === 0}
          >
            {method === "card" ? "Continuar para o pagamento" : "Gerar QR Code Pix"}
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted">
            Ao finalizar você concorda com nossas{" "}
            <Link href="/politicas/trocas" className="underline">
              políticas de troca
            </Link>{" "}
            e{" "}
            <Link href="/politicas/privacidade" className="underline">
              privacidade
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

function PaymentOption({
  value,
  current,
  onSelect,
  disabled,
  icon,
  title,
  description,
}: {
  readonly value: Method;
  readonly current: Method | null;
  readonly onSelect: (m: Method) => void;
  readonly disabled: boolean;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={`flex min-h-24 flex-col items-start gap-2 rounded-sm border p-4 text-left transition-colors ${
        selected ? "border-ink bg-cream" : "border-line-strong hover:border-ink"
      } disabled:opacity-50`}
    >
      <span className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </span>
      <span className="text-xs leading-relaxed text-ink-soft">{description}</span>
    </button>
  );
}
