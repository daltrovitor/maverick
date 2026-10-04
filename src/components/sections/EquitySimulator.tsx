// Hello World
"use client";

import { useMemo, useState } from "react";
import * as m from "motion/react-m";
import { formatBRL, formatBRLCompact, formatInteger, formatPercent } from "@/lib/format";
import {
  MAVERICK_SHARE,
  REVENUE_RATES,
  simulate,
  UNIT_ECONOMICS,
  UNITS_MAX,
  UNITS_MIN,
  UNITS_PRESETS,
  UNITS_STEP,
  VALUATION_REVENUE_MULTIPLE,
  VIRAWEB_SHARE,
  type TicketMode,
} from "@/lib/simulator";

const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;
const MAVERICK_COLOR = "#9a6a1c";
const VIRAWEB_COLOR = "#2965ae";

interface EquitySimulatorProps {
  readonly onChange?: (units: number, mode: TicketMode) => void;
}

export function EquitySimulator({ onChange }: EquitySimulatorProps) {
  const [units, setUnits] = useState(500);
  const [mode, setMode] = useState<TicketMode>("cap");
  const result = useMemo(() => simulate(units, mode), [units, mode]);
  const progress = ((units - UNITS_MIN) / (UNITS_MAX - UNITS_MIN)) * 100;

  const update = (nextUnits: number, nextMode: TicketMode) => {
    setUnits(nextUnits);
    setMode(nextMode);
    onChange?.(nextUnits, nextMode);
  };

  const costRows = [
    { label: "Produção das peças", value: result.costs.product },
    { label: "Embalagem premium e frete subsidiado", value: result.costs.fulfillment },
    { label: `Impostos (${formatPercent(REVENUE_RATES.taxes)})`, value: result.costs.taxes },
    { label: `Gateway Pix + cartão (${formatPercent(REVENUE_RATES.payments)})`, value: result.costs.payments },
    { label: `Comissões de afiliados (${formatPercent(REVENUE_RATES.affiliates)})`, value: result.costs.affiliates },
    { label: `Marketing e operação (${formatPercent(REVENUE_RATES.marketing)})`, value: result.costs.marketing },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-line bg-line lg:grid-cols-12">
      {/* Controles */}
      <div className="flex flex-col gap-7 bg-white p-5 sm:p-7 lg:col-span-5">
        <div>
          <p id="ticket-label" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Ticket médio
          </p>
          <div role="radiogroup" aria-labelledby="ticket-label" className="mt-3 grid grid-cols-2 rounded-sm border border-line p-1">
            {(Object.keys(UNIT_ECONOMICS) as TicketMode[]).map((option) => {
              const selected = option === mode;
              const economics = UNIT_ECONOMICS[option];
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update(units, option)}
                  className={`relative flex min-h-14 flex-col items-center justify-center px-2 text-center transition-colors ${
                    selected ? "text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {selected && <m.span layoutId="ticket-mode" className="absolute inset-0 rounded-xs bg-ink" transition={SPRING} />}
                  <span className="relative text-sm font-medium">{option === "cap" ? "Boné" : "Combo Gym"}</span>
                  <span className="tabular relative text-xs opacity-80">{formatBRL(economics.averageTicket)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor="units-slider" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Pedidos por mês
            </label>
            <output htmlFor="units-slider" className="tabular text-3xl font-semibold tracking-tight text-ink">
              {formatInteger(result.units)}
            </output>
          </div>
          <input
            id="units-slider"
            type="range"
            min={UNITS_MIN}
            max={UNITS_MAX}
            step={UNITS_STEP}
            value={units}
            onChange={(event) => update(Number(event.target.value), mode)}
            aria-valuetext={`${formatInteger(units)} pedidos por mês`}
            className="range mt-2"
            style={{ ["--range-progress" as string]: `${progress}%` }}
          />
          <div className="mt-1 grid grid-cols-4 gap-1">
            {UNITS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => update(preset, mode)}
                aria-pressed={units === preset}
                className={`tabular min-h-12 rounded-xs border font-mono text-xs transition-colors ${
                  units === preset ? "border-ink text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                {formatInteger(preset)}
              </button>
            ))}
          </div>
        </div>

        <details className="group border-t border-line pt-4 text-sm">
          <summary className="flex min-h-12 items-center justify-between text-ink">
            Premissas e custos do mês
            <span aria-hidden="true" className="font-mono text-xs text-muted transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <table className="mt-2 w-full text-left text-[13px]">
            <caption className="sr-only">Custos mensais estimados</caption>
            <tbody>
              {costRows.map((row) => (
                <tr key={row.label} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 font-normal text-ink-soft">
                    {row.label}
                  </th>
                  <td className="tabular py-2 text-right text-ink">{formatBRL(row.value)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 pr-3 font-medium text-ink">
                  Custo total
                </th>
                <td className="tabular py-2 text-right font-medium text-ink">{formatBRL(result.totalCosts)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Custo de produção de {formatBRL(UNIT_ECONOMICS[mode].productCost)} e logística de{" "}
            {formatBRL(UNIT_ECONOMICS[mode].fulfillmentCost)} por pedido. Valuation por múltiplo conservador de{" "}
            {VALUATION_REVENUE_MULTIPLE}× a receita anualizada. Simulação ilustrativa, não constitui garantia de resultado.
          </p>
        </details>
      </div>

      {/* Resultados */}
      <div className="flex flex-col gap-8 bg-white p-5 sm:p-7 lg:col-span-7" aria-live="polite">
        <div>
          <p className="text-sm text-muted">Lucro líquido mensal estimado</p>
          <p className="tabular mt-1 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">{formatBRL(result.netProfit)}</p>
        </div>

        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xs border border-line bg-line sm:grid-cols-3">
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-muted">Faturamento bruto / mês</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-ink">{formatBRLCompact(result.grossRevenue)}</dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-muted">Margem líquida</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-ink">{formatPercent(result.netMargin)}</dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-muted">Valuation em 12 meses</dt>
            <dd className="tabular mt-1 text-xl font-semibold text-ink">{formatBRLCompact(result.valuation)}</dd>
          </div>
        </dl>

        <figure className="flex flex-col gap-3">
          <figcaption className="text-sm font-medium text-ink">Distribuição do lucro líquido entre os sócios</figcaption>
          <div className="flex h-6 w-full gap-[2px]" aria-hidden="true">
            <m.div
              className="h-full rounded-l-[4px]"
              style={{ backgroundColor: MAVERICK_COLOR }}
              animate={{ flexGrow: MAVERICK_SHARE }}
              initial={false}
              transition={SPRING}
            />
            <m.div
              className="h-full rounded-r-[4px]"
              style={{ backgroundColor: VIRAWEB_COLOR }}
              animate={{ flexGrow: VIRAWEB_SHARE }}
              initial={false}
              transition={SPRING}
            />
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: MAVERICK_COLOR }} />
              <span className="flex flex-col">
                <span className="text-sm text-ink-soft">Maverick · {formatPercent(MAVERICK_SHARE)}</span>
                <span className="tabular text-lg font-semibold text-ink">{formatBRL(result.maverickProfit)}/mês</span>
                <span className="tabular text-xs text-muted">Equity: {formatBRLCompact(result.maverickEquityValue)}</span>
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: VIRAWEB_COLOR }} />
              <span className="flex flex-col">
                <span className="text-sm text-ink-soft">ViraWeb · {formatPercent(VIRAWEB_SHARE)}</span>
                <span className="tabular text-lg font-semibold text-ink">{formatBRL(result.virawebProfit)}/mês</span>
                <span className="tabular text-xs text-muted">Equity: {formatBRLCompact(result.virawebEquityValue)}</span>
              </span>
            </li>
          </ul>
        </figure>

        <p className="border-t border-line pt-5 text-sm leading-relaxed text-ink-soft">
          Em 12 meses neste ritmo, a Maverick fatura {formatBRLCompact(result.annualRevenue)} e acumula{" "}
          {formatBRLCompact(result.annualNetProfit * MAVERICK_SHARE)} de lucro próprio — sem ter investido um real no software.
        </p>
      </div>
    </div>
  );
}
