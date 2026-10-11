// Hello World
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import polo34 from "@/assets/polo-front-34.png";
import poloBack34 from "@/assets/polo-back-34.png";
import poloBack from "@/assets/polo-back.png";
import poloFront from "@/assets/polo-front.png";
import poloLeft from "@/assets/polo-side-left.png";
import poloRight from "@/assets/polo-side-right.png";
import type { CapStage, FocusId } from "@/components/cap/CapStage";
import { ACTS } from "@/components/landing/cinematicActs";
import { RollLink } from "@/components/ui/RollLink";

const PHOTOS = [
  { src: poloFront, alt: "Boné Polo preto, vista frontal" },
  { src: polo34, alt: "Boné Polo preto, vista três quartos" },
  { src: poloRight, alt: "Boné Polo preto, lateral" },
  { src: poloLeft, alt: "Boné Polo preto, outra lateral" },
  { src: poloBack34, alt: "Boné Polo preto, traseira em três quartos" },
  { src: poloBack, alt: "Boné Polo preto, traseira com bordado POLO e fivela" },
] as const;

const VIEWS: { label: string; az: number; el: number; dist: number; focus: FocusId }[] = [
  { label: "Frente", az: 0, el: 0.21, dist: 1, focus: "center" },
  { label: "Bordado", az: 0.1, el: 0.12, dist: 0.8, focus: "pony" },
  { label: "Lateral", az: Math.PI / 2, el: 0.2, dist: 1, focus: "center" },
  { label: "Traseira", az: Math.PI, el: 0.24, dist: 1.02, focus: "center" },
  { label: "Tira", az: Math.PI + 0.4, el: 0.06, dist: 0.98, focus: "center" },
];

/**
 * Versão sem animação de rolagem (movimento reduzido) ou sem WebGL: mesma narrativa em
 * texto, com o boné 3D girado por botões/arraste — ou, sem WebGL, as fotos reais.
 */
export function StaticPresentation({ productHref }: { readonly productHref: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<CapStage | null>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [view, setView] = useState(0);

  useEffect(() => {
    let disposed = false;
    let resizer: ResizeObserver | null = null;
    (async () => {
      const mod = await import("@/components/cap/CapStage");
      if (disposed) return;
      if (!mod.supportsWebGL() || !canvasRef.current || !boxRef.current) {
        setWebgl(false);
        return;
      }
      const stage = new mod.CapStage({ canvas: canvasRef.current, reducedMotion: true, quality: "low" });
      try {
        await stage.load();
      } catch {
        stage.dispose();
        setWebgl(false);
        return;
      }
      if (disposed) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;
      const box = boxRef.current;
      stage.resize(box.clientWidth, box.clientHeight);
      stage.setRig({ ...VIEWS[0]!, tx: 0, ty: 0, tz: 0 }, true);
      stage.setActive(true);
      resizer = new ResizeObserver(([e]) => e && stage.resize(e.contentRect.width, e.contentRect.height));
      resizer.observe(box);
      setWebgl(true);
    })();
    return () => {
      disposed = true;
      resizer?.disconnect();
      stageRef.current?.dispose();
      stageRef.current = null;
    };
  }, []);

  const show = (index: number) => {
    setView(index);
    const stage = stageRef.current;
    const v = VIEWS[index];
    if (!stage || !v) return;
    const f = stage.anchor(v.focus);
    stage.resetView();
    stage.setRig({ az: v.az, el: v.el, dist: v.dist, tx: f.x, ty: f.y, tz: f.z }, true);
  };

  return (
    <section aria-labelledby="hero-title" className="bg-paper">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <div ref={boxRef} className={`relative aspect-[4/3] w-full ${webgl === false ? "hidden" : ""}`}>
            <canvas
              ref={canvasRef}
              tabIndex={0}
              aria-label="Boné em 3D. Arraste ou use as setas para girar."
              className="h-full w-full touch-pan-y"
            />
          </div>
          {webgl ? (
            <div role="group" aria-label="Vistas do boné" className="mt-4 flex flex-wrap gap-2">
              {VIEWS.map((v, i) => (
                <button
                  key={v.label}
                  type="button"
                  aria-pressed={view === i}
                  onClick={() => show(i)}
                  className={`type-micro min-h-12 rounded-sm px-4 ${view === i ? "bg-ink text-paper" : "border border-line-strong hover:border-ink"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : null}
          {webgl === false ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PHOTOS.map((p) => (
                <li key={p.alt} className="overflow-hidden rounded-xs bg-cream">
                  <Image src={p.src} alt={p.alt} sizes="(min-width: 640px) 30vw, 45vw" className="h-auto w-full" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <h1 id="hero-title" className="type-brand text-[clamp(1.8rem,4vw,2.75rem)] leading-tight">
            <span className="sr-only">Maverick Capshop — </span>
            {ACTS[0]!.title}
          </h1>
          <ul className="mt-8 grid gap-5">
            {ACTS.slice(1, 7).map((a) => (
              <li key={a.id} className="border-t border-line pt-4">
                <h2 className="font-medium">{a.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{a.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <RollLink href="/loja">Explorar a coleção</RollLink>
            {productHref ? (
              <Link href={productHref} className="type-micro inline-flex min-h-12 items-center border-b border-ink/40">
                Ver este boné
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
