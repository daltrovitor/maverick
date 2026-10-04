// Hello World
"use client";

import { useEffect, useRef, useState } from "react";
import { CapScene, type FrameInfo, type HotspotId, type PartId } from "@/components/cap/CapScene";
import type { EditionId } from "@/components/cap/editions";
import { CAP_HOTSPOTS } from "@/lib/content";

export interface CapSceneApi {
  setRotation: (yaw: number, pitch: number) => void;
  setAutoRotate: (enabled: boolean) => void;
}

interface CapCanvasProps {
  readonly edition: EditionId;
  readonly exploded: boolean;
  readonly activeHotspot: HotspotId | null;
  readonly reducedMotion: boolean;
  readonly onSelectHotspot: (id: HotspotId) => void;
  readonly onRotate: (yaw: number, pitch: number) => void;
  readonly onReady: (api: CapSceneApi) => void;
  readonly onError: () => void;
}

const PART_LABELS: Readonly<Record<PartId, string>> = {
  botao: "Botão forrado",
  copa: "Copa estruturada · 6 gomos",
  bordado: "Bordado 3D puff",
  aba: "Aba pré-curvada · 8 pespontos",
  subaba: "Sub-aba contrastante",
  forro: "Forro acetinado",
  faixa: "Faixa antissuor",
  fecho: "Couro legítimo + fivela",
  selo: "Selo numerado",
};

const PART_IDS = Object.keys(PART_LABELS) as PartId[];

/** Rótulos à esquerda da âncora para peças que se afastam para a esquerda na vista 3/4. */
const LEFT_LABELS: ReadonlySet<PartId> = new Set<PartId>(["bordado", "selo", "aba"]);

function readSerifFamily(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--font-instrument").trim();
  return value || "Georgia, serif";
}

export default function CapCanvas({
  edition,
  exploded,
  activeHotspot,
  reducedMotion,
  onSelectHotspot,
  onRotate,
  onReady,
  onError,
}: CapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CapScene | null>(null);
  const hotspotRefs = useRef<Partial<Record<HotspotId, HTMLButtonElement | null>>>({});
  const labelRefs = useRef<Partial<Record<PartId, HTMLSpanElement | null>>>({});
  const callbacks = useRef({ onRotate, onReady, onError });
  const initial = useRef({ edition, exploded, reducedMotion });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacks.current = { onRotate, onReady, onError };
  }, [onRotate, onReady, onError]);

  // Criação da cena (uma vez).
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let onVisibility: (() => void) | null = null;

    const handleFrame = (frame: FrameInfo) => {
      const hotspotOpacity = Math.max(0, 1 - frame.explode * 2.5);
      for (const [id, point] of Object.entries(frame.hotspots) as Array<[HotspotId, FrameInfo["hotspots"][HotspotId]]>) {
        const element = hotspotRefs.current[id];
        if (!element) continue;
        const visible = point.visible && hotspotOpacity > 0.05;
        element.style.transform = `translate3d(${point.x - 24}px, ${point.y - 24}px, 0)`;
        element.style.opacity = visible ? String(hotspotOpacity) : "0";
        element.style.pointerEvents = visible ? "auto" : "none";
        element.tabIndex = visible ? 0 : -1;
      }
      for (const id of PART_IDS) {
        const element = labelRefs.current[id];
        const point = frame.parts[id];
        if (!element) continue;
        element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
        element.style.opacity = String(Math.max(0, frame.explode * 1.4 - 0.4));
      }
    };

    const start = async () => {
      const serifFamily = readSerifFamily();
      try {
        await document.fonts?.load(`400 70px ${serifFamily}`);
      } catch {
        // Fonte indisponível: a etiqueta usa o fallback serifado.
      }
      if (cancelled) return;

      let scene: CapScene;
      try {
        scene = new CapScene({
          canvas,
          edition: initial.current.edition,
          reducedMotion: initial.current.reducedMotion,
          serifFamily,
          onFrame: handleFrame,
          onRotate: (yaw, pitch) => callbacks.current.onRotate(yaw, pitch),
        });
      } catch {
        callbacks.current.onError();
        return;
      }
      sceneRef.current = scene;
      scene.setExploded(initial.current.exploded);

      const rect = container.getBoundingClientRect();
      scene.resize(rect.width, rect.height);
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) scene.resize(entry.contentRect.width, entry.contentRect.height);
      });
      resizeObserver.observe(container);

      let inView = false;
      const sync = () => scene.setActive(inView && document.visibilityState === "visible");
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          inView = entries.some((entry) => entry.isIntersecting);
          sync();
        },
        { rootMargin: "120px" },
      );
      intersectionObserver.observe(container);
      onVisibility = sync;
      document.addEventListener("visibilitychange", onVisibility);

      callbacks.current.onReady({
        setRotation: (yaw, pitch) => scene.setRotation(yaw, pitch),
        setAutoRotate: (enabled) => scene.setAutoRotate(enabled),
      });
      setReady(true);
    };

    void start();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setEdition(edition);
  }, [edition, ready]);

  useEffect(() => {
    sceneRef.current?.setExploded(exploded);
  }, [exploded, ready]);

  useEffect(() => {
    if (activeHotspot) sceneRef.current?.focus(activeHotspot);
  }, [activeHotspot, ready]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className={`size-full touch-pan-y select-none transition-opacity duration-700 active:cursor-grabbing ${
          ready ? "cursor-grab opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Hotspots projetados do 3D */}
      {CAP_HOTSPOTS.map((hotspot, index) => (
        <button
          key={hotspot.id}
          ref={(element) => {
            hotspotRefs.current[hotspot.id] = element;
          }}
          type="button"
          onClick={() => onSelectHotspot(hotspot.id)}
          aria-label={`Detalhe ${index + 1}: ${hotspot.title}`}
          aria-pressed={activeHotspot === hotspot.id}
          tabIndex={-1}
          className="group absolute left-0 top-0 flex size-12 items-center justify-center opacity-0 transition-opacity duration-200"
        >
          <span
            className={`flex size-7 items-center justify-center rounded-xs border font-mono text-[11px] tabular shadow-[0_1px_6px_rgb(31_22_18/0.18)] transition-colors ${
              activeHotspot === hotspot.id
                ? "border-ink bg-ink text-white"
                : "border-line-strong bg-white text-ink group-hover:border-ink"
            }`}
          >
            {index + 1}
          </span>
        </button>
      ))}

      {/* Rótulos da vista explodida */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {PART_IDS.map((id) => (
          <span
            key={id}
            ref={(element) => {
              labelRefs.current[id] = element;
            }}
            className="absolute left-0 top-0 opacity-0"
          >
            <span
              className={`flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-ink sm:text-[11px] ${
                LEFT_LABELS.has(id) ? "-translate-x-[calc(100%-3px)] flex-row-reverse" : "-translate-x-[3px]"
              }`}
            >
              <span className="size-1.5 shrink-0 bg-ink" />
              <span className="bg-white/85 px-1">{PART_LABELS[id]}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
