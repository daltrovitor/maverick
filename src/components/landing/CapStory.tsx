// Hello World
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import capFront from "@/assets/cap-b-front.png";
import type { AnchorId, CapStage, ProjectedPoint } from "@/components/cap/CapStage";
import { CHAPTERS, poseAt } from "@/components/landing/storyChapters";
import { RollLink } from "@/components/ui/RollLink";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const MAX_LABELS = 3;
/** Fração da largura da foto ocupada pelo boné (medida no arquivo: 634 de 683 px). */
const POSTER_CAP_RATIO = 634 / 683;
const LABEL_OFFSET = 150;

/**
 * Composição tríptica fixada na rolagem:
 *  - fundo: palavra monumental do capítulo;
 *  - meio: o boné em 3D (com a foto real como pôster até o WebGL carregar);
 *  - frente: anotações ligadas a pontos do modelo, contador e controles.
 */
export function CapStory({ primaryHref }: { readonly primaryHref: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<CapStage | null>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);
  const dotRefs = useRef<Array<SVGCircleElement | null>>([]);
  const chapterRef = useRef(0);

  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);
  const [staticMode, setStaticMode] = useState(false);
  const [interacted, setInteracted] = useState(false);
  // Desenvolvimento: ?calibrar sobrepõe a foto a 50% para conferir a fidelidade do 3D.
  const [calibrate, setCalibrate] = useState(false);

  const annotations = CHAPTERS[chapter]?.annotations ?? [];

  // Posiciona etiquetas e linhas-guia direto no DOM a cada quadro renderizado (sem re-render React).
  const onFrame = useCallback((anchors: Readonly<Record<AnchorId, ProjectedPoint>>) => {
    const list = CHAPTERS[chapterRef.current]?.annotations ?? [];
    for (let i = 0; i < MAX_LABELS; i += 1) {
      const label = labelRefs.current[i];
      const line = lineRefs.current[i];
      const dot = dotRefs.current[i];
      const item = list[i];
      const point = item ? anchors[item.anchor] : undefined;
      if (!label || !line || !dot) continue;
      if (!item || !point || !point.visible) {
        label.style.opacity = "0";
        line.style.opacity = "0";
        dot.style.opacity = "0";
        continue;
      }
      const dir = item.side === "right" ? 1 : -1;
      const lx = point.x + dir * LABEL_OFFSET;
      const ly = point.y - 26;
      label.style.opacity = "1";
      label.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(${dir > 0 ? "0" : "-100%"}, -50%)`;
      line.setAttribute("x1", String(point.x));
      line.setAttribute("y1", String(point.y));
      line.setAttribute("x2", String(lx));
      line.setAttribute("y2", String(ly));
      line.style.opacity = "1";
      dot.setAttribute("cx", String(point.x));
      dot.setAttribute("cy", String(point.y));
      dot.style.opacity = "1";
    }
  }, []);

  // Decide o modo e carrega o WebGL depois da primeira pintura (o pôster é o LCP).
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let observer: IntersectionObserver | null = null;
    let resizer: ResizeObserver | null = null;

    const start = async () => {
      const mod = await import("@/components/cap/CapStage");
      if (disposed || !canvasRef.current || !stageBoxRef.current) return;
      if (!mod.supportsWebGL()) return;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const stage = new mod.CapStage({
        canvas: canvasRef.current,
        reducedMotion: reduced,
        quality: coarse || window.innerWidth < 768 ? "low" : "high",
        onFrame,
        onInteract: () => setInteracted(true),
      });
      try {
        await stage.load();
      } catch (err) {
        console.error("[3D] falha ao carregar o modelo", err);
        stage.dispose();
        return;
      }
      if (disposed) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;
      const box = stageBoxRef.current;
      // O quadro inicial do 3D ocupa exatamente o espaço do pôster (troca imperceptível).
      const syncFrame = () => {
        const poster = posterRef.current?.getBoundingClientRect().width ?? 0;
        stage.setFrameWidth(poster > 0 ? poster * POSTER_CAP_RATIO : null);
      };
      stage.resize(box.clientWidth, box.clientHeight);
      syncFrame();
      stage.setPose(poseAt(0).pose, true);
      if (calibrating) stage.setSway(false);
      resizer = new ResizeObserver(([entry]) => {
        if (entry) stage.resize(entry.contentRect.width, entry.contentRect.height);
        syncFrame();
      });
      resizer.observe(box);
      observer = new IntersectionObserver(([entry]) => stage.setActive(Boolean(entry?.isIntersecting)), {
        rootMargin: "120px",
      });
      if (sectionRef.current) observer.observe(sectionRef.current);
      setReady(true);
    };

    if (reduced) setStaticMode(true);
    const calibrating =
      process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("calibrar");
    if (calibrating) setCalibrate(true);
    const idle = window.setTimeout(() => void start(), 120);
    return () => {
      disposed = true;
      window.clearTimeout(idle);
      observer?.disconnect();
      resizer?.disconnect();
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [onFrame]);

  // Rolagem → pose do boné, palavra de fundo e capítulo ativo.
  useGSAP(
    () => {
      if (staticMode || !sectionRef.current) return;
      const words = wordsRef.current ? Array.from(wordsRef.current.children) : [];
      const update = (progress: number) => {
        const { pose, chapter: next } = poseAt(progress);
        stageRef.current?.setPose(pose);
        stageRef.current?.setSway(progress < 0.02);
        const scaled = progress * (CHAPTERS.length - 1);
        words.forEach((el, i) => {
          const d = scaled - i;
          gsap.set(el, { autoAlpha: Math.max(0, 1 - Math.abs(d) * 1.6), yPercent: -d * 26 });
        });
        if (next !== chapterRef.current) {
          chapterRef.current = next;
          setChapter(next);
        }
      };
      update(0);
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => update(self.progress),
      });
    },
    { scope: sectionRef, dependencies: [staticMode] },
  );

  if (staticMode) {
    return <StaticHero primaryHref={primaryHref} />;
  }

  const current = CHAPTERS[chapter]!;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      className="relative bg-paper"
      style={{ height: `${CHAPTERS.length * 100}dvh` }}
    >
      <div className="sticky top-16 h-[calc(100dvh-4rem)] overflow-hidden sm:top-[72px] sm:h-[calc(100dvh-72px)]">
        {/* Plano de fundo: palavra monumental */}
        <div ref={wordsRef} aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          {CHAPTERS.map((c, i) => (
            <span
              key={c.id}
              className="type-monument absolute w-full px-4 text-center text-[clamp(4.5rem,19vw,19rem)] whitespace-nowrap text-[#ece3d2]"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              {c.word}
            </span>
          ))}
        </div>

        {/* Plano médio: boné */}
        <div ref={stageBoxRef} className="absolute inset-x-0 top-[9%] bottom-[24%] sm:top-[6%] sm:bottom-[14%]">
          <Image
            ref={posterRef}
            src={capFront}
            alt="Boné dad hat preto com o B vermelho bordado, vista frontal"
            priority
            placeholder="empty"
            sizes="(min-width: 768px) 46vw, 86vw"
            className={`absolute top-1/2 left-1/2 z-10 h-auto w-[min(86vw,46vh*1.16)] -translate-x-1/2 -translate-y-1/2 mix-blend-multiply transition-opacity duration-700 sm:w-[min(46vw,58vh*1.16)] ${
              calibrate ? "pointer-events-none opacity-50" : ready ? "opacity-0" : "opacity-100"
            }`}
          />
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Boné em 3D. Arraste para girar; use as setas do teclado para girar e + ou − para aproximar."
            className={`absolute inset-0 h-full w-full touch-pan-y outline-none transition-opacity duration-700 focus-visible:outline-2 focus-visible:outline-gold-ink ${
              ready ? "cursor-grab opacity-100 active:cursor-grabbing" : "opacity-0"
            }`}
          />
        </div>

        {/* Plano frontal: anotações ancoradas no modelo (telas médias e grandes) */}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full md:block">
          {Array.from({ length: MAX_LABELS }, (_, i) => (
            <g key={i}>
              <line
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                stroke="#86611d"
                strokeWidth="1"
                strokeDasharray="3 4"
                style={{ opacity: 0, transition: "opacity .35s" }}
              />
              <circle
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                r="3.5"
                fill="#b88a2e"
                style={{ opacity: 0, transition: "opacity .35s" }}
              />
            </g>
          ))}
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
          {Array.from({ length: MAX_LABELS }, (_, i) => (
            <div
              key={i}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              className="type-micro absolute top-0 left-0 rounded-xs border border-line bg-paper/90 px-2.5 py-1.5 whitespace-nowrap text-ink shadow-[0_6px_20px_-12px_rgba(38,23,10,0.5)] backdrop-blur-sm"
              style={{ opacity: 0, transition: "opacity .35s" }}
            >
              {annotations[i]?.label}
            </div>
          ))}
        </div>

        {/* Texto do capítulo */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-10">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative min-h-[11rem] w-full max-w-xl sm:min-h-[12.5rem]">
              {CHAPTERS.map((c, i) => {
                const active = i === chapter;
                const Heading = i === 0 ? "h1" : "h2";
                return (
                  <div
                    key={c.id}
                    inert={!active}
                    className={`absolute inset-x-0 bottom-0 transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] ${
                      active ? "pointer-events-auto translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                    }`}
                  >
                    <p className="type-micro text-gold-ink">
                      {String(i + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
                    </p>
                    <Heading id={i === 0 ? "hero-title" : undefined} className="type-brand mt-3 text-[clamp(1.6rem,4vw,2.75rem)] leading-tight">
                      {i === 0 ? <span className="sr-only">Maverick Capshop — </span> : null}
                      {c.title}
                    </Heading>
                    <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">{c.text}</p>
                    {c.annotations.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2 md:hidden">
                        {c.annotations.map((a) => (
                          <li key={a.label} className="type-micro rounded-xs border border-line px-2 py-1 text-ink-soft">
                            {a.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {i === 0 || i === CHAPTERS.length - 1 ? (
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <RollLink href={primaryHref}>Explorar a coleção</RollLink>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="pointer-events-auto flex items-center gap-2 self-start lg:self-end">
              {ready ? (
                <>
                  <span className={`type-micro mr-2 hidden text-muted transition-opacity sm:inline ${interacted ? "opacity-0" : "opacity-100"}`}>
                    Arraste para girar
                  </span>
                  <StageButton label="Afastar" onClick={() => stageRef.current?.zoomBy(1 / 1.18)}>
                    <Minus className="size-4" aria-hidden="true" />
                  </StageButton>
                  <StageButton label="Aproximar" onClick={() => stageRef.current?.zoomBy(1.18)}>
                    <Plus className="size-4" aria-hidden="true" />
                  </StageButton>
                  <StageButton label="Voltar à vista original" onClick={() => stageRef.current?.resetView()}>
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </StageButton>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-12 place-items-center rounded-sm border border-line-strong bg-paper/80 text-ink backdrop-blur-sm transition-colors hover:border-ink"
    >
      {children}
    </button>
  );
}

/** Versão estática (movimento reduzido): mesma mensagem, sem fixação nem animação de rolagem. */
function StaticHero({ primaryHref }: { readonly primaryHref: string }) {
  return (
    <section aria-labelledby="hero-title" className="bg-paper">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-14 sm:px-8 lg:grid-cols-12">
        <div className="relative lg:col-span-7">
          <p aria-hidden="true" className="type-monument absolute inset-0 grid place-items-center text-[clamp(4rem,16vw,14rem)] text-[#ece3d2]">
            Maverick
          </p>
          <Image src={capFront} alt="Boné dad hat preto com o B vermelho bordado, vista frontal" priority sizes="(min-width: 1024px) 50vw, 90vw" className="relative mx-auto h-auto w-full max-w-xl mix-blend-multiply" />
        </div>
        <div className="lg:col-span-5">
          <h1 id="hero-title" className="type-brand text-[clamp(1.8rem,4vw,2.75rem)] leading-tight">
            <span className="sr-only">Maverick Capshop — </span>
            {CHAPTERS[0]!.title}
          </h1>
          <p className="mt-4 text-ink-soft">{CHAPTERS[0]!.text}</p>
          <ul className="mt-8 grid gap-4">
            {CHAPTERS.slice(1, 4).map((c) => (
              <li key={c.id} className="border-t border-line pt-4">
                <h2 className="font-medium">{c.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{c.text}</p>
              </li>
            ))}
          </ul>
          <RollLink href={primaryHref} className="mt-8">
            Explorar a coleção
          </RollLink>
        </div>
      </div>
    </section>
  );
}
