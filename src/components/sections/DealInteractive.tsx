// Hello World
"use client";

import { useCallback, useState, type MouseEvent } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { MaverickMonogram } from "@/components/brand/MaverickMonogram";
import { ViraWebLogo } from "@/components/brand/ViraWebLogo";
import { EquitySimulator } from "@/components/sections/EquitySimulator";
import { formatBRL, formatInteger } from "@/lib/format";
import { simulate, UNIT_ECONOMICS, type TicketMode } from "@/lib/simulator";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const CELEBRATION_COLORS = ["#d4af37", "#2965ae", "#f2bf12", "#1f1612", "#faf6f0"];

function buildAcceptMessage(units: number, mode: TicketMode): string {
  const result = simulate(units, mode);
  return [
    "Olá, ViraWeb! Sou o fundador da Maverick Headwear & Lifestyle.",
    "Quero assinar o Acordo de Parceria (25% de equity + 25% dos lucros líquidos) e iniciar o desenvolvimento.",
    `Cenário que simulei: ${formatInteger(result.units)} pedidos/mês com ticket de ${formatBRL(UNIT_ECONOMICS[mode].averageTicket)}, lucro líquido estimado de ${formatBRL(result.netProfit)}/mês.`,
    "Vamos agendar a reunião de kickoff?",
  ].join("\n\n");
}

export function DealInteractive() {
  const reduce = useReducedMotion();
  const [scenario, setScenario] = useState<{ units: number; mode: TicketMode }>({ units: 500, mode: "cap" });
  const [accepted, setAccepted] = useState(false);
  const href = buildWhatsAppUrl(buildAcceptMessage(scenario.units, scenario.mode));

  const handleChange = useCallback((units: number, mode: TicketMode) => setScenario({ units, mode }), []);

  const celebrate = async (event: MouseEvent<HTMLAnchorElement>) => {
    setAccepted(true);
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };
    try {
      const { default: confetti } = await import("canvas-confetti");
      void confetti({
        particleCount: 110,
        spread: 75,
        startVelocity: 38,
        ticks: 220,
        origin,
        colors: CELEBRATION_COLORS,
        shapes: ["square"],
        disableForReducedMotion: true,
      });
    } catch {
      // Celebração é opcional: o link do WhatsApp segue funcionando.
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <EquitySimulator onChange={handleChange} />

      <div className="on-dark grid grid-cols-1 gap-8 rounded-sm bg-ink p-6 text-white sm:p-10 lg:grid-cols-12 lg:items-end lg:gap-x-8">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-4" aria-hidden="true">
            <span className="flex size-12 items-center justify-center rounded-xs bg-white p-2">
              <ViraWebLogo className="h-auto w-full" />
            </span>
            <span className="font-mono text-sm text-white/70">×</span>
            <span className="flex size-12 items-center justify-center rounded-xs bg-[#2b1d16] p-1.5">
              <MaverickMonogram className="h-auto w-full" color="#d4af37" background="#2b1d16" />
            </span>
          </div>
          <h3 className="mt-6 font-serif text-4xl leading-[1.05] sm:text-5xl">
            Pronto para tirar a Maverick da DM e levar para o <span className="italic text-champagne">mercado inteiro</span>?
          </h3>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
            Ao aceitar, você abre uma conversa direta com a ViraWeb já com o cenário que simulou acima. O acordo societário é
            formalizado em contrato antes de qualquer linha de código.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-5">
          <m.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={celebrate}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm bg-champagne px-6 text-center text-[15px] font-semibold text-ink transition-colors hover:bg-[#e0bf55]"
          >
            Assinar Acordo de Parceria &amp; Iniciar Desenvolvimento
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </m.a>
          <div className="min-h-6" aria-live="polite">
            <AnimatePresence>
              {accepted && (
                <m.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm text-champagne"
                >
                  <Check className="size-4" aria-hidden="true" />
                  Abrindo o WhatsApp da ViraWeb com a mensagem pronta.
                </m.p>
              )}
            </AnimatePresence>
          </div>
          <p className="text-xs leading-relaxed text-white/65">Abre o WhatsApp (62) 99251-6554 em uma nova aba.</p>
        </div>
      </div>
    </div>
  );
}
