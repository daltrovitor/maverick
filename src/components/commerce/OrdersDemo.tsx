// Hello World
"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { ArrowRight, MessageCircle, Plus } from "lucide-react";
import { formatBRLCents } from "@/lib/format";

const STEPS = ["Separando", "Enviado", "Entregue"] as const;
type Step = (typeof STEPS)[number];

interface Order {
  readonly id: number;
  readonly customer: string;
  readonly city: string;
  readonly item: string;
  readonly total: number;
  readonly payment: "Pix" | "Cartão";
  readonly step: Step;
}

const INITIAL_ORDERS: readonly Order[] = [
  { id: 1026, customer: "Rafael", city: "Uberlândia/MG", item: "Black Edition", total: 159, payment: "Pix", step: "Separando" },
  { id: 1025, customer: "Camila", city: "Rio Verde/GO", item: "Sand & Leather + Oversized", total: 420, payment: "Cartão", step: "Enviado" },
  { id: 1024, customer: "Diego", city: "Barretos/SP", item: "Hunter Green", total: 159, payment: "Pix", step: "Entregue" },
];

const NEW_ORDER_POOL: ReadonlyArray<Omit<Order, "id" | "step">> = [
  { customer: "Larissa", city: "Sinop/MT", item: "Trucker Premium", total: 149, payment: "Pix" },
  { customer: "Thiago", city: "Londrina/PR", item: "Drop 002 · Nº 041", total: 219, payment: "Cartão" },
  { customer: "Bruna", city: "Goiânia/GO", item: "Black Edition + Dry-Fit", total: 328, payment: "Pix" },
  { customer: "Mateus", city: "Campo Grande/MS", item: "Snapback Clássico", total: 159, payment: "Pix" },
];

const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

export function OrdersDemo() {
  const [orders, setOrders] = useState<readonly Order[]>(INITIAL_ORDERS);
  const [alert, setAlert] = useState<Order | null>(null);
  const [poolIndex, setPoolIndex] = useState(0);

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), 4500);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const addOrder = () => {
    const template = NEW_ORDER_POOL[poolIndex % NEW_ORDER_POOL.length];
    if (!template) return;
    const nextId = Math.max(...orders.map((order) => order.id)) + 1;
    const order: Order = { ...template, id: nextId, step: "Separando" };
    setOrders((current) => [order, ...current].slice(0, 5));
    setPoolIndex((value) => value + 1);
    setAlert(order);
  };

  const advance = (id: number) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== id) return order;
        const index = STEPS.indexOf(order.step);
        const next = STEPS[Math.min(STEPS.length - 1, index + 1)] ?? order.step;
        return { ...order, step: next };
      }),
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="min-h-[5.5rem]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {alert ? (
            <m.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING}
              className="flex items-start gap-3 rounded-sm border border-line bg-cream px-4 py-3"
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <div className="text-sm leading-relaxed">
                <p className="font-medium text-ink">WhatsApp · Maverick Pedidos</p>
                <p className="text-ink-soft">
                  Novo pedido #{alert.id} · {alert.payment} confirmado · {formatBRLCents(alert.total)} · {alert.city}
                </p>
              </div>
            </m.div>
          ) : (
            <m.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full items-center justify-between gap-4 rounded-sm border border-dashed border-line-strong px-4 py-3"
            >
              <p className="text-sm text-muted">Cada pedido pago dispara um alerta no WhatsApp do lojista.</p>
              <button
                type="button"
                onClick={addOrder}
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-sm bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-espresso"
              >
                <Plus className="size-4" aria-hidden="true" />
                Simular pedido
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        <AnimatePresence initial={false}>
          {orders.map((order) => {
            const stepIndex = STEPS.indexOf(order.step);
            const done = order.step === "Entregue";
            return (
              <m.li
                key={order.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      <span className="tabular font-mono text-xs text-muted">#{order.id}</span> {order.customer} · {order.city}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {order.item} · {formatBRLCents(order.total)}
                    </p>
                  </div>
                  <ol className="col-span-2 flex gap-1 sm:col-span-1" aria-label={`Status do pedido ${order.id}: ${order.step}`}>
                    {STEPS.map((step, index) => (
                      <li key={step} className="flex flex-1 flex-col gap-1">
                        <span className={`h-0.5 w-full ${index <= stepIndex ? "bg-ink" : "bg-line"}`} />
                        <span className={`text-[11px] ${index === stepIndex ? "font-medium text-ink" : "text-muted"}`}>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() => advance(order.id)}
                    disabled={done}
                    aria-label={done ? `Pedido ${order.id} entregue` : `Avançar status do pedido ${order.id}`}
                    className="col-start-2 row-start-1 inline-flex size-12 items-center justify-center rounded-sm border border-line text-ink transition-colors hover:border-ink disabled:border-transparent disabled:text-muted sm:col-start-3"
                  >
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
