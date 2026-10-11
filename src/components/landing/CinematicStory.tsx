// Hello World
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { AnchorId, CapStage, ProjectedPoint, Rig } from "@/components/cap/CapStage";
import { INTRO_EXIT_EVENT } from "@/components/brand/introGate";
import { ACTS, actAt, rigAt } from "@/components/landing/cinematicActs";
import { StaticPresentation } from "@/components/landing/StaticPresentation";
import { MaverickLogo } from "@/components/brand/MaverickLogo";
import { RollLink } from "@/components/ui/RollLink";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const MAX_LABELS = 3;

/** Desenvolvimento: ?vista=frente|lateral|traseira|34 trava a câmera para comparar com as fotos. */
const CALIBRATION_VIEWS: Record<string, Partial<Rig>> = {
  frente: { az: 0, el: 0.2, dist: 1, frameX: 0, frameY: 0 },
  "34": { az: -0.62, el: 0.24, dist: 1, frameX: 0, frameY: 0 },
  lateral: { az: Math.PI / 2, el: 0.12, dist: 1, frameX: 0, frameY: 0 },
  "lateral-esq": { az: -Math.PI / 2, el: 0.18, dist: 1, frameX: 0, frameY: 0 },
  traseira: { az: Math.PI, el: 0.26, dist: 1, frameX: 0, frameY: 0 },
};
const LABEL_OFFSET = 140;

/**
 * Apresentação cinematográfica do boné principal, conduzida pela rolagem.
 * Composição tríptica: palavra monumental ao fundo, boné 3D no plano médio, texto e
 * anotações no plano frontal. A câmera percorre oito atos (ver cinematicActs).
 */
export function CinematicStory({ productHref }: { readonly productHref: string | null }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<CapStage | null>(null);
  const labelRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);
  const dotRefs = useRef<Array<SVGCircleElement | null>>([]);
  const progressRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const actsRef = useRef<HTMLDivElement>(null);
  const actRef = useRef(0);
  const scrollProgress = useRef(0);
  const boxSize = useRef({ w: 1, h: 1 });
  const calibrationRef = useRef<Partial<Rig> | null>(null);

  // Movimento reduzido, sem WebGL ou contexto perdido: apresentação estática.
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [webglFailed, setWebglFailed] = useState(false);
  const cinematic = !reducedMotion && !webglFailed;
  const [act, setAct] = useState(0);
  const [ready, setReady] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const lenis = useLenis();

  const applyRig = useCallback((progress: number, immediate = false) => {
    const stage = stageRef.current;
    if (!stage) return;
    if (calibrationRef.current) {
      stage.setRig({ tx: 0, ty: 0, tz: 0, key: 1, fill: 0.72, rim: 0.85, exposure: 1.02, ...calibrationRef.current }, true);
      return;
    }
    const rig: Rig = rigAt(progress, (id) => stage.anchor(id));
    stage.setRig(rig, immediate);
  }, []);

  // Etiquetas e linhas-guia atualizadas direto no DOM a cada quadro renderizado, sempre dentro
  // da área do boné (nunca sobre o texto dos atos).
  const onFrame = useCallback((anchors: Readonly<Record<AnchorId, ProjectedPoint>>) => {
    const list = ACTS[actRef.current]?.annotations ?? [];
    const { w, h } = boxSize.current;
    const widths = labelRefs.current.map((el) => el?.offsetWidth ?? 0);
    for (let i = 0; i < MAX_LABELS; i += 1) {
      const label = labelRefs.current[i];
      const line = lineRefs.current[i];
      const dot = dotRefs.current[i];
      if (!label || !line || !dot) continue;
      const item = list[i];
      const point = item ? anchors[item.anchor] : undefined;
      if (!item || !point || !point.visible) {
        label.style.opacity = "0";
        line.style.opacity = "0";
        dot.style.opacity = "0";
        continue;
      }
      const labelW = widths[i] ?? 0;
      let dir = item.side === "right" ? 1 : -1;
      // Sem espaço do lado pedido, a etiqueta vai para o outro lado do ponto.
      if (dir > 0 && point.x + LABEL_OFFSET + labelW > w - 8) dir = -1;
      else if (dir < 0 && point.x - LABEL_OFFSET - labelW < 8) dir = 1;
      const lx = dir > 0 ? Math.min(point.x + LABEL_OFFSET, w - labelW - 8) : Math.max(point.x - LABEL_OFFSET, labelW + 8);
      const ly = Math.min(h - 20, Math.max(20, point.y - 30));
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

  // Inicializa o WebGL depois da primeira pintura (o título é o primeiro conteúdo visível).
  useEffect(() => {
    if (!cinematic) return;
    if (process.env.NODE_ENV === "development") {
      const view = new URLSearchParams(window.location.search).get("vista");
      calibrationRef.current = view ? (CALIBRATION_VIEWS[view] ?? null) : null;
    }
    let disposed = false;
    let observer: IntersectionObserver | null = null;
    let resizer: ResizeObserver | null = null;
    let stopIntroWait = () => {};

    const start = async () => {
      const mod = await import("@/components/cap/CapStage");
      if (disposed || !canvasRef.current || !stageBoxRef.current) return;
      if (!mod.supportsWebGL()) {
        setWebglFailed(true);
        return;
      }
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const stage = new mod.CapStage({
        canvas: canvasRef.current,
        reducedMotion: false,
        quality: coarse || window.innerWidth < 768 ? "low" : "high",
        onFrame,
        onInteract: () => setInteracted(true),
        onContextLost: () => setWebglFailed(true),
      });
      try {
        await stage.load();
      } catch (err) {
        console.error("[3D] falha ao carregar o modelo", err);
        stage.dispose();
        setWebglFailed(true);
        return;
      }
      if (disposed) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;
      const box = stageBoxRef.current;
      boxSize.current = { w: box.clientWidth, h: box.clientHeight };
      stage.resize(box.clientWidth, box.clientHeight);
      applyRig(scrollProgress.current, true);
      resizer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        boxSize.current = { w: entry.contentRect.width, h: entry.contentRect.height };
        stage.resize(entry.contentRect.width, entry.contentRect.height);
      });
      resizer.observe(box);
      observer = new IntersectionObserver(([entry]) => stage.setActive(Boolean(entry?.isIntersecting)), {
        rootMargin: "200px",
      });
      if (sectionRef.current) observer.observe(sectionRef.current);
      // O boné entra (desce girando) junto com a página: depois da abertura da marca, se houver.
      const reveal = () => {
        setReady(true);
        stage.playEntrance();
      };
      if (document.documentElement.dataset.intro === "playing") {
        window.addEventListener(INTRO_EXIT_EVENT, reveal, { once: true });
        stopIntroWait = () => window.removeEventListener(INTRO_EXIT_EVENT, reveal);
      } else {
        reveal();
      }
    };

    const idle = window.setTimeout(() => void start(), 60);
    return () => {
      disposed = true;
      window.clearTimeout(idle);
      stopIntroWait();
      observer?.disconnect();
      resizer?.disconnect();
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, [applyRig, onFrame, cinematic]);

  // Celular: mede o texto mais alto dos atos; a área do boné termina acima dele.
  useEffect(() => {
    const acts = actsRef.current;
    const sticky = stickyRef.current;
    if (!cinematic || !acts || !sticky) return;
    const panels = [...acts.querySelectorAll<HTMLElement>("[data-act]")];
    const measure = () => {
      const tallest = Math.max(0, ...panels.map((panel) => panel.offsetHeight));
      acts.style.height = `${tallest}px`;
      sticky.style.setProperty("--acts-h", `${tallest}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    panels.forEach((panel) => observer.observe(panel));
    return () => observer.disconnect();
  }, [cinematic]);

  // Linha do tempo: rolagem → câmera, luz e pose do boné (contínua) + tipografia (GSAP).
  useGSAP(
    (_context, contextSafe) => {
      if (!cinematic || !sectionRef.current || !contextSafe) return;
      const section = sectionRef.current;
      let stopIntroWait = () => {};

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          scrollProgress.current = self.progress;
          applyRig(self.progress);
          const next = actAt(self.progress);
          if (next !== actRef.current) {
            actRef.current = next;
            setAct(next);
          }
          if (progressRef.current) progressRef.current.style.transform = `scaleX(${self.progress})`;
        },
      });

      // contextSafe: a linha do tempo nasce depois das fontes (assíncrono) e ainda é desfeita ao desmontar.
      const build = contextSafe(() => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.8 },
        });
        const blocks = gsap.utils.toArray<HTMLElement>("[data-act]", section);
        blocks.forEach((block, i) => {
          const range = ACTS[i]!.range;
          const split = SplitText.create(block.querySelectorAll("[data-split]"), { type: "lines", mask: "lines" });
          const extra = block.querySelectorAll("[data-fade]");
          const inAt = Math.max(0, range[0] + 0.004);
          if (i === 0) {
            if (document.documentElement.dataset.intro === "playing") {
              // Abertura da marca na tela: o primeiro ato sobe quando ela começa a sair.
              gsap.set(split.lines, { yPercent: 115 });
              const reveal = contextSafe(() => {
                gsap.to(split.lines, { yPercent: 0, duration: 1.25, stagger: 0.08, ease: "expo.out", delay: 0.3 });
              });
              window.addEventListener(INTRO_EXIT_EVENT, reveal, { once: true });
              stopIntroWait = () => window.removeEventListener(INTRO_EXIT_EVENT, reveal);
            } else {
              // Sem abertura, o primeiro ato já começa visível (sem tela vazia na chegada).
              gsap.set(split.lines, { yPercent: 0 });
            }
          } else {
            tl.fromTo(split.lines, { yPercent: 115 }, { yPercent: 0, duration: 0.022, stagger: 0.006 }, inAt);
            if (extra.length) tl.fromTo(extra, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.02 }, inAt + 0.012);
          }
          if (i < blocks.length - 1) {
            const outAt = range[1] - 0.026;
            tl.to(split.lines, { yPercent: -115, duration: 0.018, stagger: 0.004, ease: "power2.in" }, outAt);
            if (extra.length) tl.to(extra, { autoAlpha: 0, duration: 0.014, ease: "power2.in" }, outAt);
          }
        });
        tl.set({}, {}, 1);
      });

      // As linhas dependem das fontes carregadas para quebrar corretamente.
      if (document.fonts?.status === "loaded") build();
      else document.fonts?.ready.then(build).catch(build);
      return () => stopIntroWait();
    },
    { scope: sectionRef, dependencies: [cinematic] },
  );

  const goToAct = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const travel = section.offsetHeight - window.innerHeight;
    const target = top + travel * Math.max(0, (ACTS[index]?.range[0] ?? 0) + 0.02);
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  };

  if (!cinematic) return <StaticPresentation productHref={productHref} />;

  const current = ACTS[act]!;
  const last = act === ACTS.length - 1;

  return (
    <section ref={sectionRef} aria-labelledby="hero-title" className="relative h-[1000dvh] bg-paper md:h-[1300dvh]">
      <a
        href="#colecao"
        className="sr-only-focusable absolute top-4 right-4 z-30 rounded-sm bg-ink px-4 py-3 text-sm text-paper"
      >
        Pular a apresentação
      </a>

      <div
        ref={stickyRef}
        className="sticky top-16 h-[calc(100dvh-4rem)] overflow-hidden sm:top-[72px] sm:h-[calc(100dvh-72px)]"
        style={{ "--acts-h": "15rem" } as CSSProperties}
      >
        {/* Plano médio: o boné tem área própria — nunca passa por baixo nem por cima do texto. */}
        <div
          ref={stageBoxRef}
          className="absolute inset-x-0 top-16 bottom-[calc(var(--acts-h)+2.5rem)] md:top-6 md:right-16 md:bottom-24 md:left-[40%] lg:right-44"
        >
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Boné em 3D. Arraste para girar; setas do teclado giram e + ou − aproximam."
            className={`h-full w-full touch-pan-y outline-none transition-opacity duration-1000 focus-visible:outline-2 focus-visible:outline-gold-ink ${
              ready ? "cursor-grab opacity-100 active:cursor-grabbing" : "opacity-0"
            }`}
          />
          {!ready ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
              <div className="flex flex-col items-center gap-4 text-ink-soft">
                <MaverickLogo variant="monogram" className="h-10 animate-[fade-up_1.2s_var(--ease-out-expo)_both] text-ink/80" />
                <span className="type-micro">Preparando o boné em 3D</span>
              </div>
            </div>
          ) : null}

          {/* Anotações ancoradas no modelo, presas dentro desta área */}
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
                  style={{ opacity: 0, transition: "opacity .4s" }}
                />
                <circle
                  ref={(el) => {
                    dotRefs.current[i] = el;
                  }}
                  r="3.5"
                  fill="#b88a2e"
                  style={{ opacity: 0, transition: "opacity .4s" }}
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
                style={{ opacity: 0, transition: "opacity .4s" }}
              >
                {current.annotations[i]?.label}
              </div>
            ))}
          </div>
        </div>

        {/* Texto dos atos: coluna própria à esquerda (desktop) ou faixa de baixo (celular). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:inset-y-0 md:right-auto md:flex md:w-[40%] md:items-center md:px-10 md:pb-0">
          <div ref={actsRef} className="relative w-full max-w-md md:min-h-[19rem]">
            {ACTS.map((a, i) => {
              const Heading = i === 0 ? "h1" : "h2";
              const active = i === act;
              return (
                <div
                  key={a.id}
                  data-act
                  inert={!active}
                  className={`absolute inset-x-0 bottom-0 transition-opacity duration-500 md:top-1/2 md:bottom-auto md:-translate-y-1/2 ${
                    active ? "pointer-events-auto opacity-100" : "opacity-0"
                  }`}
                >
                  <Heading id={i === 0 ? "hero-title" : undefined} data-split className="type-brand text-[clamp(1.6rem,3.4vw,3rem)] leading-[1.08]">
                    {i === 0 ? <span className="sr-only">Maverick Capshop — </span> : null}
                    {a.title}
                  </Heading>
                  <p data-split className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-ink-soft md:mt-4 md:text-base">
                    {a.text}
                  </p>
                  {a.annotations.length > 0 ? (
                    <ul data-fade className="mt-3 flex flex-wrap gap-2 md:hidden">
                      {a.annotations.map((n) => (
                        <li key={n.label} className="type-micro rounded-xs border border-line bg-paper/80 px-2 py-1 text-ink-soft">
                          {n.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {i === ACTS.length - 1 ? (
                    <div data-fade className="mt-5 flex flex-wrap items-center gap-4 md:mt-6">
                      <RollLink href="/loja">Explorar a coleção</RollLink>
                      {productHref ? (
                        <Link href={productHref} className="type-micro inline-flex min-h-12 items-center border-b border-ink/40 hover:border-ink">
                          Ver este boné
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Índice de capítulos (navegação funcional) */}
        <nav aria-label="Capítulos da apresentação" className="absolute top-1/2 right-4 hidden -translate-y-1/2 lg:block">
          <ol className="flex flex-col items-end gap-1">
            {ACTS.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => goToAct(i)}
                  aria-current={i === act ? "step" : undefined}
                  className="group flex min-h-9 items-center gap-3 py-1"
                >
                  <span
                    className={`type-micro transition-opacity ${i === act ? "text-ink opacity-100" : "text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
                  >
                    {a.nav}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`block h-px transition-all duration-500 ${i === act ? "w-8 bg-ink" : "w-4 bg-line-strong group-hover:bg-ink-soft"}`}
                  />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Controles do visualizador */}
        <div className="absolute top-3 right-3 flex items-center gap-2 md:top-auto md:right-10 md:bottom-8">
          {ready ? (
            <>
              <span
                className={`type-micro mr-1 hidden text-muted transition-opacity duration-500 sm:inline ${
                  interacted && act !== 6 ? "opacity-0" : "opacity-100"
                }`}
              >
                Arraste para girar
              </span>
              <StageButton label="Afastar" onClick={() => stageRef.current?.zoomBy(1 / 1.2)}>
                <Minus className="size-4" aria-hidden="true" />
              </StageButton>
              <StageButton label="Aproximar" onClick={() => stageRef.current?.zoomBy(1.2)}>
                <Plus className="size-4" aria-hidden="true" />
              </StageButton>
              <StageButton label="Voltar ao enquadramento da apresentação" onClick={() => stageRef.current?.resetView()}>
                <RotateCcw className="size-4" aria-hidden="true" />
              </StageButton>
            </>
          ) : null}
        </div>

        {/* Progresso da apresentação */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-line">
          <div ref={progressRef} className="h-full origin-left scale-x-0 bg-gold" />
        </div>

        <p className="sr-only" aria-live="polite">
          {`Capítulo ${act + 1} de ${ACTS.length}: ${current.nav}${last ? "." : ""}`}
        </p>
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
      className="grid size-12 place-items-center rounded-sm border border-line-strong bg-paper/85 text-ink backdrop-blur-sm transition-colors hover:border-ink"
    >
      {children}
    </button>
  );
}
