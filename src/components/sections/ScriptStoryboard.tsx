// Hello World
"use client";

import { useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { VIRAL_SCRIPTS } from "@/lib/content";

const TOTAL_SECONDS = 20;
const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

export function ScriptStoryboard() {
  const reduce = useReducedMotion();
  const [scriptIndex, setScriptIndex] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);
  const script = VIRAL_SCRIPTS[scriptIndex] ?? VIRAL_SCRIPTS[0]!;
  const beatIndex = Math.max(
    0,
    script.beats.findIndex((beat) => time >= beat.from && time < beat.to),
  );
  const activeBeat = time >= TOTAL_SECONDS ? script.beats.length - 1 : beatIndex;
  const beat = script.beats[activeBeat] ?? script.beats[0]!;

  const timeRef = useRef(0);
  const seek = (value: number) => {
    timeRef.current = value;
    setTime(value);
  };

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const loop = (now: number) => {
      const next = Math.min(TOTAL_SECONDS, timeRef.current + (now - last) / 1000);
      last = now;
      timeRef.current = next;
      setTime(next);
      if (next >= TOTAL_SECONDS) {
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing]);

  const selectScript = (index: number) => {
    setScriptIndex(index);
    seek(0);
    setPlaying(false);
  };

  const togglePlay = () => {
    if (time >= TOTAL_SECONDS) seek(0);
    setPlaying((value) => !value);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-8">
      <div role="tablist" aria-label="Roteiros validados" aria-orientation="vertical" className="flex flex-col border-t border-line-strong lg:col-span-4">
        {VIRAL_SCRIPTS.map((item, index) => {
          const selected = index === scriptIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`script-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="script-panel"
              onClick={() => selectScript(index)}
              className="relative flex min-h-12 flex-col items-start gap-1 border-b border-line py-5 pl-5 text-left"
            >
              {selected && <m.span layoutId="script-indicator" className="absolute inset-y-3 left-0 w-0.5 bg-ink" transition={SPRING} />}
              <span className="tabular font-mono text-[11px] text-muted">Roteiro {index + 1}</span>
              <span className={`font-serif text-2xl leading-tight ${selected ? "text-ink" : "text-ink-soft"}`}>{item.title}</span>
              <span className="text-sm text-muted">{item.angle}</span>
            </button>
          );
        })}
      </div>

      <div
        id="script-panel"
        role="tabpanel"
        aria-labelledby={`script-tab-${script.id}`}
        className="flex flex-col gap-6 rounded-sm border border-line bg-white p-5 sm:p-6 lg:col-span-8"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Reels / TikTok · 9:16 · 20 s</p>
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex min-h-12 items-center gap-2 rounded-sm border border-line-strong px-4 text-sm text-ink transition-colors hover:border-ink"
          >
            {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {playing ? "Pausar" : "Reproduzir"}
            <span className="tabular font-mono text-xs text-muted">{time.toFixed(1).replace(".", ",")} s</span>
          </button>
        </div>

        {/* Linha do tempo segmentada por batida */}
        <div className="relative">
          <ol className="flex gap-0.5" aria-label="Linha do tempo do roteiro">
            {script.beats.map((item, index) => (
              <li key={item.label} style={{ flexGrow: item.to - item.from, flexBasis: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    seek(item.from);
                  }}
                  aria-current={index === activeBeat ? "step" : undefined}
                  className="flex w-full flex-col gap-2 text-left"
                >
                  <span className={`block h-12 w-full transition-colors ${index === activeBeat ? "bg-ink" : "bg-cream"}`} />
                  <span className="flex flex-col">
                    <span className={`text-xs font-medium ${index === activeBeat ? "text-ink" : "text-muted"}`}>{item.label}</span>
                    <span className="tabular font-mono text-[11px] text-muted">
                      {item.from}–{item.to} s
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {!reduce && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-12 w-px bg-champagne"
              style={{ left: `${(time / TOTAL_SECONDS) * 100}%` }}
            />
          )}
        </div>

        <div className="min-h-[7rem]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={`${script.id}-${beat.label}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING}
            >
              <p className="text-sm font-medium text-ink">
                {beat.label} <span className="tabular font-mono text-xs font-normal text-muted">· {beat.from}–{beat.to} s</span>
              </p>
              <p className="mt-2 max-w-2xl font-serif text-2xl leading-snug text-ink sm:text-3xl">{beat.text}</p>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
