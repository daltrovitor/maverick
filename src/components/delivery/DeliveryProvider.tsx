// Hello World
"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { normalizeCep } from "@/lib/br";
import { NO_SHIPPING_PRICING, parseDelivery, type Delivery, type ShippingPricing } from "@/lib/shipping-pricing";

const STORAGE_KEY = "maverick.delivery.v1";

/* ───────── Destino guardado no navegador (lido fora do React, sem divergência de hidratação) ───────── */

const listeners = new Set<() => void>();
/** Sem armazenamento (modo privado): o destino vale só nesta aba. */
let memoryRaw: string | null = null;
let cachedRaw: string | null | undefined;
let cachedDelivery: Delivery | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function readDelivery(): Delivery | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDelivery = parseDelivery(raw);
  }
  return cachedDelivery;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function writeDelivery(delivery: Delivery | null): void {
  memoryRaw = delivery ? JSON.stringify(delivery) : null;
  try {
    if (memoryRaw) window.localStorage.setItem(STORAGE_KEY, memoryRaw);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Armazenamento indisponível: segue em memória.
  }
  for (const listener of listeners) listener();
}

const subscribeNothing = () => () => {};

export type CepLookup =
  | { ok: true; delivery: Delivery }
  | { ok: false; reason: "invalid" | "not_found" | "unavailable" };

/** Consulta o CEP no ViaCEP (o servidor confere de novo no checkout). */
export async function lookupCep(input: string): Promise<CepLookup> {
  const cep = normalizeCep(input);
  if (!cep) return { ok: false, reason: "invalid" };
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, reason: res.status === 400 ? "not_found" : "unavailable" };
    const body = (await res.json()) as { erro?: unknown; uf?: unknown; localidade?: unknown };
    if (body.erro) return { ok: false, reason: "not_found" };
    const delivery = parseDelivery(
      JSON.stringify({ cep, uf: typeof body.uf === "string" ? body.uf.toUpperCase() : "", city: body.localidade }),
    );
    return delivery ? { ok: true, delivery } : { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/* ───────── Contexto ───────── */

interface DeliveryContextValue {
  readonly pricing: ShippingPricing;
  /** Destino do cliente; null até hidratar e enquanto ele não informar o CEP. */
  readonly delivery: Delivery | null;
  readonly hydrated: boolean;
  readonly setDelivery: (delivery: Delivery | null) => void;
  readonly promptOpen: boolean;
  /** `focus`: aberto por um clique (leva o foco ao campo); a abertura automática não rouba o foco. */
  readonly promptFocus: boolean;
  readonly openPrompt: (options?: { focus?: boolean }) => void;
  readonly closePrompt: () => void;
}

const FALLBACK: DeliveryContextValue = {
  pricing: NO_SHIPPING_PRICING,
  delivery: null,
  hydrated: false,
  setDelivery: () => {},
  promptOpen: false,
  promptFocus: false,
  openPrompt: () => {},
  closePrompt: () => {},
};

const DeliveryContext = createContext<DeliveryContextValue>(FALLBACK);

export function DeliveryProvider({ pricing, children }: { readonly pricing: ShippingPricing; readonly children: ReactNode }) {
  const delivery = useSyncExternalStore(subscribe, readDelivery, () => null);
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [prompt, setPrompt] = useState<{ open: boolean; focus: boolean }>({ open: false, focus: false });

  const openPrompt = useCallback((options?: { focus?: boolean }) => setPrompt({ open: true, focus: options?.focus ?? true }), []);
  const closePrompt = useCallback(() => setPrompt({ open: false, focus: false }), []);

  const value = useMemo<DeliveryContextValue>(
    () => ({
      pricing,
      delivery,
      hydrated,
      setDelivery: writeDelivery,
      promptOpen: prompt.open,
      promptFocus: prompt.focus,
      openPrompt,
      closePrompt,
    }),
    [pricing, delivery, hydrated, prompt, openPrompt, closePrompt],
  );

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDelivery(): DeliveryContextValue {
  return useContext(DeliveryContext);
}
