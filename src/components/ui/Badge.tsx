// Hello World
import type { ReactNode } from "react";
import type { Tone } from "@/lib/order-status";

/** Selo de status funcional (pedidos, candidaturas). Cantos arquitetônicos, sem pílula. */
const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-cream text-ink-soft",
  waiting: "border-gold/50 bg-[#fbf3e1] text-gold-ink",
  positive: "border-success/30 bg-[#eef5ef] text-success",
  negative: "border-danger/30 bg-[#fbeeed] text-danger",
  info: "border-ink/20 bg-cream-deep text-ink",
};

export function Badge({ tone = "neutral", children }: { readonly tone?: Tone; readonly children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-xs border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
