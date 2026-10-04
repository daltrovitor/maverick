// Hello World
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Move3d, RotateCcw } from "lucide-react";
import type { CapSceneApi } from "@/components/cap/CapCanvas";
import type { HotspotId } from "@/components/cap/CapScene";
import { CapIllustration } from "@/components/cap/CapIllustration";
import { CAP_EDITIONS, EDITION_ORDER, type EditionId } from "@/components/cap/editions";
import { SectionIntro } from "@/components/ui/SectionIntro";
import { CAP_HOTSPOTS } from "@/lib/content";

const CapCanvas = dynamic(() => import("@/components/cap/CapCanvas"), { ssr: false });

const DEG = 180 / Math.PI;
const INITIAL_YAW_DEG = 324;
const INITIAL_PITCH_DEG = 11;
const PITCH_MIN_DEG = -20;
const PITCH_MAX_DEG = 43;

function setRangeProgress(input: HTMLInputElement | null, value: number, min: number, max: number): void {
  if (!input) return;
  input.value = String(Math.round(value));
  input.style.setProperty("--range-progress", `${((value - min) / (max - min)) * 100}%`);
}

export function CapShowcase() {
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const yawRef = useRef<HTMLInputElement>(null);
  const pitchRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<CapSceneApi | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [edition, setEdition] = useState<EditionId>("black");
  const [exploded, setExploded] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<HotspotId | null>(null);

  // Carrega o Three.js apenas quando a seção se aproxima da viewport.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const handleReady = useCallback((api: CapSceneApi) => {
    apiRef.current = api;
    setLoaded(true);
  }, []);

  const handleRotate = useCallback((yaw: number, pitch: number) => {
    setRangeProgress(yawRef.current, (yaw * DEG) % 360, 0, 359);
    setRangeProgress(pitchRef.current, pitch * DEG, PITCH_MIN_DEG, PITCH_MAX_DEG);
  }, []);

  const handleSliderInput = () => {
    const yaw = Number(yawRef.current?.value ?? INITIAL_YAW_DEG);
    const pitch = Number(pitchRef.current?.value ?? INITIAL_PITCH_DEG);
    setRangeProgress(yawRef.current, yaw, 0, 359);
    setRangeProgress(pitchRef.current, pitch, PITCH_MIN_DEG, PITCH_MAX_DEG);
    apiRef.current?.setRotation(yaw / DEG, pitch / DEG);
  };

  const resetView = () => {
    setActiveHotspot(null);
    setExploded(false);
    apiRef.current?.setRotation(INITIAL_YAW_DEG / DEG, INITIAL_PITCH_DEG / DEG);
    apiRef.current?.setAutoRotate(true);
  };

  const selectHotspot = (id: HotspotId) => {
    setExploded(false);
    setActiveHotspot(id);
  };

  const active = CAP_HOTSPOTS.find((hotspot) => hotspot.id === activeHotspot) ?? null;
  const current = CAP_EDITIONS[edition];

  return (
    <section id="produto-3d" aria-labelledby="produto-3d-title" className="border-t border-line bg-white">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="produto-3d-title"
          index="02 / 07"
          meta="Demo ao vivo · WebGL"
          title="O boné Maverick em 3D, do bordado ao fecho de couro."
          emphasis={["3D,"]}
        >
          <p>
            Fotos estáticas escondem o que justifica o preço. No site, o cliente gira o boné em 360°, troca a edição, abre a
            vista explodida e toca nos detalhes técnicos — prova de valor que vende sozinha, a qualquer hora.
          </p>
        </SectionIntro>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-8">
          {/* Palco 3D */}
          <div className="lg:col-span-8">
            <div
              ref={stageRef}
              className="relative aspect-square w-full overflow-hidden rounded-sm border border-line bg-cream sm:aspect-[4/3]"
            >
              <div
                aria-hidden="true"
                className={`absolute inset-0 flex items-center justify-center p-10 transition-opacity duration-700 ${
                  loaded && !failed ? "opacity-0" : "opacity-100"
                }`}
              >
                <CapIllustration edition={edition} idPrefix="stage" className="h-auto w-full max-w-md" />
              </div>

              {shouldLoad && !failed && (
                <CapCanvas
                  edition={edition}
                  exploded={exploded}
                  activeHotspot={activeHotspot}
                  reducedMotion={reduce}
                  onSelectHotspot={selectHotspot}
                  onRotate={handleRotate}
                  onReady={handleReady}
                  onError={() => setFailed(true)}
                />
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 bg-gradient-to-t from-cream via-cream/80 to-transparent p-4 pt-10 sm:p-5 sm:pt-12">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft sm:text-[11px]">
                  <span className="text-ink">{current.name}</span>
                  <span className="hidden sm:inline"> · {current.fabricLabel}</span>
                </p>
                <p className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:flex sm:text-[11px]">
                  <Move3d className="size-3.5" aria-hidden="true" />
                  {failed ? "Visualização estática" : "Arraste para girar"}
                </p>
              </div>
            </div>
            <p className="sr-only" aria-live="polite">
              {failed
                ? "O navegador não suporta WebGL; exibindo ilustração estática do boné."
                : loaded
                  ? `Modelo 3D carregado: ${current.name}.`
                  : ""}
            </p>
          </div>

          {/* Painel de controle */}
          <div className="flex flex-col gap-8 lg:col-span-4">
            <fieldset>
              <legend className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Edição</legend>
              <div className="mt-3 grid grid-cols-1 gap-2" role="radiogroup" aria-label="Edição do boné">
                {EDITION_ORDER.map((id) => {
                  const option = CAP_EDITIONS[id];
                  const checked = edition === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => setEdition(id)}
                      className={`relative flex min-h-14 items-center gap-3 rounded-sm border px-3 text-left transition-colors ${
                        checked ? "border-ink" : "border-line hover:border-line-strong"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-6 shrink-0 rounded-xs border border-black/10"
                        style={{ backgroundColor: option.colors.crown }}
                      />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-ink">{option.name}</span>
                        <span className="text-xs text-muted">{option.fabricLabel}</span>
                      </span>
                      {checked && (
                        <m.span
                          layoutId="edition-indicator"
                          className="absolute inset-y-2 left-0 w-0.5 bg-ink"
                          transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Detalhes técnicos</h3>
              <ol className="mt-3 border-t border-line">
                {CAP_HOTSPOTS.map((hotspot, index) => (
                  <li key={hotspot.id} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => selectHotspot(hotspot.id)}
                      aria-pressed={activeHotspot === hotspot.id}
                      className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-xs border font-mono text-[11px] tabular ${
                          activeHotspot === hotspot.id ? "border-ink bg-ink text-white" : "border-line-strong text-ink"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm text-ink">{hotspot.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="min-h-[7.5rem]" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {active ? (
                    <m.div
                      key={active.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      className="pt-4"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-champagne-ink">{active.spec}</p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{active.body}</p>
                    </m.div>
                  ) : (
                    <m.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 text-sm leading-relaxed text-muted">
                      Toque em um número no boné ou na lista para girar o modelo até o detalhe.
                    </m.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span id="explode-label" className="text-sm font-medium text-ink">
                  Vista explodida
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={exploded}
                  aria-labelledby="explode-label"
                  onClick={() => {
                    setActiveHotspot(null);
                    setExploded((value) => !value);
                  }}
                  className="flex h-12 w-16 items-center justify-center"
                >
                  <span className={`relative h-6 w-11 rounded-xs border transition-colors ${exploded ? "border-ink bg-ink" : "border-line-strong bg-white"}`}>
                    <m.span
                      className={`absolute top-0.5 size-[18px] rounded-[2px] ${exploded ? "bg-white" : "bg-ink"}`}
                      animate={{ left: exploded ? 22 : 2 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    />
                  </span>
                </button>
              </div>
              <p className="text-xs leading-relaxed text-muted">Separa as 9 camadas de montagem: copa, aba, forro, faixa, fecho e mais.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="cap-yaw" className="flex items-center justify-between text-sm font-medium text-ink">
                Rotação 360°
              </label>
              <input
                ref={yawRef}
                id="cap-yaw"
                type="range"
                min={0}
                max={359}
                step={1}
                defaultValue={INITIAL_YAW_DEG}
                onInput={handleSliderInput}
                disabled={!loaded}
                className="range"
                style={{ ["--range-progress" as string]: `${(INITIAL_YAW_DEG / 359) * 100}%` }}
              />
              <label htmlFor="cap-pitch" className="text-sm font-medium text-ink">
                Inclinação
              </label>
              <input
                ref={pitchRef}
                id="cap-pitch"
                type="range"
                min={PITCH_MIN_DEG}
                max={PITCH_MAX_DEG}
                step={1}
                defaultValue={INITIAL_PITCH_DEG}
                onInput={handleSliderInput}
                disabled={!loaded}
                className="range"
                style={{
                  ["--range-progress" as string]: `${((INITIAL_PITCH_DEG - PITCH_MIN_DEG) / (PITCH_MAX_DEG - PITCH_MIN_DEG)) * 100}%`,
                }}
              />
              <button
                type="button"
                onClick={resetView}
                disabled={!loaded}
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-sm border border-line-strong px-4 text-sm text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Restaurar vista
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
