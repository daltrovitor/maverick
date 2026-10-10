// Hello World
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { refreshCartLines, type CartLineSnapshot } from "@/app/(site)/cart-actions";

export interface CartLine extends CartLineSnapshot {
  quantity: number;
}

interface StoredLine {
  variantId: string;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  ready: boolean;
  refreshing: boolean;
  count: number;
  subtotalCents: number;
  isOpen: boolean;
  /** Aviso quando a revalidação ajustou algo (preço, estoque, item indisponível). */
  notice: string | null;
  open: () => void;
  close: () => void;
  add: (snapshot: CartLineSnapshot, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "maverick.cart.v1";
const MAX_QTY = 20;

function readStored(): StoredLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is StoredLine =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as StoredLine).variantId === "string" &&
          Number.isInteger((l as StoredLine).quantity),
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

function writeStored(lines: CartLine[]) {
  try {
    const minimal: StoredLine[] = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
  } catch {
    // Armazenamento indisponível (modo privado): a sacola segue em memória.
  }
}

interface ServerLines {
  next: CartLine[];
  changed: boolean;
}

/** Confere preço e estoque atuais no servidor e devolve a sacola ajustada (sem tocar no estado). */
async function fetchServerLines(stored: StoredLine[], previous: readonly CartLine[]): Promise<ServerLines> {
  const fresh = await refreshCartLines(stored.map((s) => s.variantId));
  const byId = new Map(fresh.map((f) => [f.variantId, f]));
  let changed = false;
  const next: CartLine[] = [];
  for (const s of stored) {
    const snap = byId.get(s.variantId);
    if (!snap || snap.stock <= 0) {
      changed = true;
      continue;
    }
    const quantity = Math.min(s.quantity, snap.stock, MAX_QTY);
    if (quantity !== s.quantity) changed = true;
    const before = previous.find((l) => l.variantId === s.variantId);
    if (before && before.unitPriceCents !== snap.unitPriceCents) changed = true;
    next.push({ ...snap, quantity });
  }
  return { next, changed };
}

export function CartProvider({ children }: { readonly children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const applyLines = useCallback(({ next, changed }: ServerLines) => {
    setLines(next);
    writeStored(next);
    setNotice(changed ? "Atualizamos sua sacola com preços e estoque atuais." : null);
  }, []);

  const reconcile = useCallback(
    async (stored: StoredLine[]) => {
      if (stored.length === 0) {
        setLines([]);
        return;
      }
      setRefreshing(true);
      try {
        applyLines(await fetchServerLines(stored, linesRef.current));
      } finally {
        setRefreshing(false);
      }
    },
    [applyLines],
  );

  // Hidratação: lê o navegador só depois de montar (evita divergência SSR/cliente). Até lá
  // `ready` é falso e a interface já mostra o carregamento; sacola vazia é o estado inicial.
  useEffect(() => {
    const stored = readStored();
    const hydrate = stored.length > 0 ? fetchServerLines(stored, linesRef.current).then(applyLines) : Promise.resolve();
    void hydrate.finally(() => setReady(true));
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) void reconcile(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyLines, reconcile]);

  const commit = useCallback((next: CartLine[]) => {
    linesRef.current = next;
    setLines(next);
    writeStored(next);
  }, []);

  const add = useCallback(
    (snapshot: CartLineSnapshot, quantity: number) => {
      const current = linesRef.current;
      const existing = current.find((l) => l.variantId === snapshot.variantId);
      const limit = Math.min(snapshot.stock, MAX_QTY);
      if (existing) {
        commit(
          current.map((l) =>
            l.variantId === snapshot.variantId ? { ...snapshot, quantity: Math.min(l.quantity + quantity, limit) } : l,
          ),
        );
      } else {
        commit([...current, { ...snapshot, quantity: Math.min(quantity, limit) }].slice(0, 20));
      }
      setNotice(null);
      setIsOpen(true);
    },
    [commit],
  );

  const setQuantity = useCallback(
    (variantId: string, quantity: number) => {
      commit(
        linesRef.current
          .map((l) =>
            l.variantId === variantId ? { ...l, quantity: Math.max(0, Math.min(quantity, l.stock, MAX_QTY)) } : l,
          )
          .filter((l) => l.quantity > 0),
      );
    },
    [commit],
  );

  const remove = useCallback(
    (variantId: string) => commit(linesRef.current.filter((l) => l.variantId !== variantId)),
    [commit],
  );

  const clear = useCallback(() => commit([]), [commit]);
  const refresh = useCallback(() => reconcile(readStored()), [reconcile]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      refreshing,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotalCents: lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0),
      isOpen,
      notice,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      setQuantity,
      remove,
      clear,
      refresh,
    }),
    [lines, ready, refreshing, isOpen, notice, add, setQuantity, remove, clear, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return ctx;
}
