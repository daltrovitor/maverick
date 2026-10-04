// Hello World
"use client";

import { useEffect, useMemo, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Check, Copy } from "lucide-react";
import {
  buildAffiliateLink,
  COMMISSION_RATE,
  computeCreatorMetrics,
  CREATORS,
  type CreatorId,
} from "@/lib/affiliates";
import { formatBRL, formatBRLCents, formatInteger, formatPercent } from "@/lib/format";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
const BAR_COLOR = "#9a6a1c";
const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

function niceMax(value: number): number {
  const step = value > 1500 ? 500 : value > 600 ? 250 : 100;
  return Math.ceil(value / step) * step;
}

function ClicksChart({ values, label }: { values: readonly number[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...values));
  const ticks = [0, max / 2, max];
  const peak = values.indexOf(Math.max(...values));
  const width = 560;
  const height = 200;
  const padLeft = 44;
  const padBottom = 26;
  const plotW = width - padLeft;
  const plotH = height - padBottom - 10;
  const band = plotW / values.length;
  const barW = Math.min(17, band * 0.45);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-ink">{label}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${label}. Pico de ${formatInteger(values[peak] ?? 0)} cliques no ${DAYS[peak]}.`}>
          {ticks.map((tick) => {
            const y = 10 + plotH - (tick / max) * plotH;
            return (
              <g key={tick}>
                <line x1={padLeft} x2={width} y1={y} y2={y} stroke="#ebe5dc" strokeWidth="1" />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" className="fill-muted font-mono" fontSize="11">
                  {formatInteger(tick)}
                </text>
              </g>
            );
          })}
          {values.map((value, i) => {
            const h = (value / max) * plotH;
            const x = padLeft + band * i + (band - barW) / 2;
            const y = 10 + plotH - h;
            const r = Math.min(4, h);
            return (
              <g key={DAYS[i]}>
                <m.path
                  d={`M${x} ${10 + plotH} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + barW - r} ${y} Q${x + barW} ${y} ${x + barW} ${y + r} L${x + barW} ${10 + plotH} Z`}
                  fill={BAR_COLOR}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  style={{ originX: 0.5, originY: 1 }}
                  transition={{ ...SPRING, delay: i * 0.03 }}
                />
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fill-muted" fontSize="11">
                  {DAYS[i]}
                </text>
                {i === peak && hover === null && (
                  <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-ink font-mono" fontSize="11">
                    {formatInteger(value)}
                  </text>
                )}
                <rect
                  x={padLeft + band * i}
                  y={0}
                  width={band}
                  height={10 + plotH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xs border border-line bg-white px-2.5 py-1.5 text-xs shadow-[0_2px_10px_rgb(31_22_18/0.10)]"
            style={{ left: `${((padLeft + band * hover + band / 2) / width) * 100}%` }}
          >
            <p className="text-muted">{DAYS[hover]}</p>
            <p className="tabular font-medium text-ink">{formatInteger(values[hover] ?? 0)} cliques</p>
          </div>
        )}
      </div>
      <details className="text-xs text-muted">
        <summary className="inline-flex min-h-12 items-center">Ver dados em tabela</summary>
        <table className="mt-1 w-full text-left">
          <thead>
            <tr>
              <th scope="col" className="py-1 font-medium">Dia</th>
              <th scope="col" className="py-1 text-right font-medium">Cliques</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, i) => (
              <tr key={DAYS[i]} className="border-t border-line">
                <td className="py-1">{DAYS[i]}</td>
                <td className="tabular py-1 text-right">{formatInteger(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xs border border-line py-1 pl-3 pr-1">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="truncate font-mono text-sm text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copiado` : `Copiar ${label.toLowerCase()}`}
        className="flex size-12 shrink-0 items-center justify-center rounded-xs text-ink transition-colors hover:bg-cream"
      >
        {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function CreatorDashboard() {
  const [active, setActive] = useState<CreatorId>("rodeio");
  const [withdrawal, setWithdrawal] = useState<string | null>(null);
  const profile = CREATORS.find((creator) => creator.id === active) ?? CREATORS[0]!;
  const metrics = useMemo(() => computeCreatorMetrics(profile), [profile]);

  const tiles = [
    { label: "Cliques (7 dias)", value: formatInteger(metrics.clicks) },
    { label: "Vendas", value: formatInteger(metrics.sales) },
    { label: "Conversão", value: formatPercent(metrics.conversion) },
    { label: `Comissão ${Math.round(COMMISSION_RATE * 100)}%`, value: formatBRL(metrics.commission) },
  ];

  return (
    <div className="flex flex-col rounded-sm border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="text-base font-medium text-ink">Painel do criador</p>
          <p className="text-sm text-muted">{profile.niche}</p>
        </div>
        <div role="tablist" aria-label="Perfil do criador" className="flex flex-wrap gap-1">
          {CREATORS.map((creator) => {
            const selected = creator.id === active;
            return (
              <button
                key={creator.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setActive(creator.id);
                  setWithdrawal(null);
                }}
                className={`relative min-h-12 px-3 text-sm transition-colors ${selected ? "text-white" : "text-ink-soft hover:text-ink"}`}
              >
                {selected && <m.span layoutId="creator-tab" className="absolute inset-0 rounded-xs bg-ink" transition={SPRING} />}
                <span className="relative">{creator.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-6" role="tabpanel" aria-label={`Métricas do perfil ${profile.label}`}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-line bg-line lg:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-white px-4 py-3">
              <dt className="text-xs text-muted">{tile.label}</dt>
              <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-ink">{tile.value}</dd>
            </div>
          ))}
        </dl>

        <ClicksChart key={profile.id} values={profile.weeklyClicks} label="Cliques no link rastreável" />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CopyField label="Link rastreável" value={buildAffiliateLink(profile.coupon)} />
          <CopyField label="Cupom exclusivo" value={profile.coupon} />
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted">Saldo disponível para saque</p>
            <p className="tabular text-xl font-semibold text-ink">{formatBRLCents(metrics.balance)}</p>
          </div>
          <button
            type="button"
            onClick={() => setWithdrawal(`Saque de ${formatBRLCents(metrics.balance)} enviado via Pix (demonstração).`)}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-espresso"
          >
            Sacar via Pix
          </button>
        </div>
        <div aria-live="polite" className="min-h-5">
          <AnimatePresence>
            {withdrawal && (
              <m.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-sm text-success"
              >
                <Check className="size-4" aria-hidden="true" />
                {withdrawal}
              </m.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
