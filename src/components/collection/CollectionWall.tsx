// Hello World
"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { CatalogImage } from "@/lib/catalog";
import type { VariantRow } from "@/lib/database.types";
import type { CollectionStage, SlotScreen } from "@/components/collection/CollectionStage";
import type { CapLookTextures } from "@/components/cap/productCapTexture";
import { CollectionDetail } from "@/components/collection/CollectionDetail";
import { INTRO_EXIT_EVENT, setIntroHold } from "@/components/brand/introGate";
import { StorePrice } from "@/components/delivery/StorePrice";

export interface WallItem {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly priceCents: number;
  readonly variants: VariantRow[];
  readonly images: CatalogImage[];
}

type Status = "loading" | "ready" | "fallback";

/** Se a abertura nunca liberar a cena (falha no JavaScript dela), a parede entra mesmo assim. */
const INTRO_FALLBACK_MS = 9000;
/** Tempo máximo esperando as fotos para pintar os bonés antes de acender a parede. */
const LOOK_TIMEOUT_MS = 6000;

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Primeira foto da primeira cor com estoque: a mesma que pinta o 3D na página do produto. */
function coverOf(item: WallItem): string | null {
  const first = item.variants.find((v) => v.stock > 0) ?? item.variants[0];
  const color = first?.color ?? null;
  const forColor = color ? item.images.find((img) => img.color === color) : undefined;
  return (forColor ?? item.images[0])?.url ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Abertura da página inicial: a coleção na parede de um estábulo. Cada produto é um boné 3D
 * pintado a partir da própria foto, numa prateleira de madeira; o cursor acende um lampião sobre
 * ele e escolher leva a câmera até o boné, com o painel de compra ao lado.
 */
export function CollectionWall({ items }: { readonly items: WallItem[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<CollectionStage | null>(null);
  const hitRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const looks = useRef(new Map<string, Promise<CapLookTextures | null>>());
  const [status, setStatus] = useState<Status>("loading");
  const [screens, setScreens] = useState<SlotScreen[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const count = items.length;

  const readLook = useCallback((url: string): Promise<CapLookTextures | null> => {
    let promise = looks.current.get(url);
    if (!promise) {
      promise = import("@/components/cap/productCapTexture")
        .then(({ readCapLook }) => readCapLook(url))
        .catch(() => null);
      looks.current.set(url, promise);
    }
    return promise;
  }, []);

  // Áreas do texto (título no alto, barra embaixo) e onde o boné escolhido aparece de perto.
  const measure = useCallback(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const box = section.getBoundingClientRect();
    const intro = introRef.current?.getBoundingClientRect();
    const bar = barRef.current?.getBoundingClientRect();
    const top = intro ? (intro.bottom - box.top + 12) / box.height : 0.2;
    const bottom = bar ? (box.bottom - bar.top + 8) / box.height : 0.1;
    const side = box.width < 640 ? 0.03 : 0.05;
    stage.setSafeArea(Math.min(0.4, top), Math.min(0.25, bottom), side);
    if (box.width >= 1024) stage.setDetailFrame({ left: 0.04, top: 0.3, width: 0.54, height: 0.56 });
    else if (box.width >= 640) stage.setDetailFrame({ left: 0.04, top: 0.2, width: 0.5, height: 0.48 });
    else stage.setDetailFrame({ left: 0.06, top: 0.15, width: 0.88, height: 0.3 });
    stage.resize(box.width, box.height);
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    const section = sectionRef.current;
    if (!host || !section || count === 0) return;
    let disposed = false;
    let stage: CollectionStage | null = null;
    const cleanups: Array<() => void> = [];

    if (!supportsWebGL()) {
      queueMicrotask(() => setStatus("fallback"));
      return;
    }

    // GPU e CPU pesada (texturas desenhadas, modelo, fotos) só quando o logo da abertura está
    // montado e parado, ou já saindo — nada engasga a animação de entrada.
    const introPlaying = document.documentElement.dataset.intro === "playing";
    let openGpu = () => {};
    const gpuGate = new Promise<void>((resolve) => (openGpu = resolve));
    let markReady = () => {};
    const stageReady = new Promise<void>((resolve) => (markReady = resolve));
    let exited = !introPlaying;
    let prepared = false;
    const reveal = () => {
      if (disposed || !prepared || !exited || !stage) return;
      stage.lightUp(introPlaying ? 1.8 : 1.1);
    };
    if (introPlaying) {
      const onExit = () => {
        if (exited) return;
        exited = true;
        openGpu();
        reveal();
      };
      setIntroHold(() => {
        openGpu();
        return stageReady;
      });
      window.addEventListener(INTRO_EXIT_EVENT, onExit, { once: true });
      const fallback = window.setTimeout(onExit, INTRO_FALLBACK_MS);
      cleanups.push(() => {
        setIntroHold(null);
        window.removeEventListener(INTRO_EXIT_EVENT, onExit);
        window.clearTimeout(fallback);
      });
    } else {
      openGpu();
    }

    void (async () => {
      try {
        const { CollectionStage } = await import("@/components/collection/CollectionStage");
        await gpuGate;
        if (disposed) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const low = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
        // Canvas novo a cada montagem: um contexto liberado em dispose() não volta.
        const canvas = document.createElement("canvas");
        canvas.className = "block h-full w-full touch-pan-y";
        host.replaceChildren(canvas);
        cleanups.push(() => canvas.remove());
        stage = new CollectionStage({
          canvas,
          count,
          reducedMotion,
          quality: low ? "low" : "high",
          onContextLost: () => setStatus("fallback"),
          onLayout: () => {
            if (stage) setScreens(stage.slotScreens());
          },
        });
        stage.darken();
        const lookTasks = items.map(async (item, i) => {
          const url = coverOf(item);
          return { i, look: url ? await readLook(url) : null };
        });
        const allLooks = Promise.race([
          Promise.all(lookTasks),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), LOOK_TIMEOUT_MS)),
        ]);
        await stage.load();
        if (disposed) return;
        stageRef.current = stage;
        const painted = await allLooks;
        if (disposed) return;
        if (painted) for (const { i, look } of painted) stage.setLook(i, look);
        // Fotos que chegarem depois do tempo limite ainda pintam o boné quando chegarem.
        else
          for (const task of lookTasks)
            void task.then(({ i, look }) => {
              if (!disposed) stageRef.current?.setLook(i, look);
            });

        measure();
        const resize = new ResizeObserver(() => measure());
        resize.observe(section);
        const visible = new IntersectionObserver(([entry]) => stageRef.current?.setActive(Boolean(entry?.isIntersecting)));
        visible.observe(section);
        cleanups.push(() => {
          resize.disconnect();
          visible.disconnect();
        });
        await stage.warmUp();
        if (disposed) return;
        prepared = true;
        markReady();
        setStatus("ready");
        reveal();
      } catch (err) {
        console.error("[3d] parede da coleção", err);
        markReady();
        if (!disposed) setStatus("fallback");
      }
    })();

    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
      stageRef.current = null;
      stage?.dispose();
    };
  }, [count, items, measure, readLook]);

  useEffect(() => {
    stageRef.current?.setHover(hovered);
  }, [hovered, status]);

  useEffect(() => {
    stageRef.current?.select(selected);
  }, [selected, status]);

  // Esc volta para a parede inteira; o foco volta ao boné que estava aberto.
  const close = useCallback(() => {
    setSelected((current) => {
      if (current !== null) requestAnimationFrame(() => hitRefs.current[current]?.focus({ preventScroll: true }));
      return null;
    });
  }, []);

  useEffect(() => {
    if (selected === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, close]);

  const onCover = useCallback(
    (index: number, url: string | null) => {
      if (!url) return;
      void readLook(url).then((look) => stageRef.current?.setLook(index, look));
    },
    [readLook],
  );

  const detail = selected !== null ? items[selected] : undefined;
  const ready = status === "ready";
  const fallback = status === "fallback";

  return (
    <section
      ref={sectionRef}
      id="colecao"
      aria-labelledby="colecao-title"
      data-mode={detail ? "detail" : "wall"}
      className="on-dark relative isolate h-[calc(100svh-4rem)] min-h-[600px] overflow-hidden bg-barn text-cream sm:h-[calc(100svh-72px)] sm:min-h-[640px]"
    >
      <div
        ref={canvasHostRef}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-700 ${
          ready ? "opacity-100" : "opacity-0"
        } ${detail ? "cursor-grab active:cursor-grabbing" : ""}`}
      />
      {/* Penumbra nas bordas: o olho vai para as prateleiras iluminadas. */}
      <div aria-hidden="true" className="barn-vignette pointer-events-none absolute inset-0" />

      <div
        ref={introRef}
        className={`relative z-10 mx-auto max-w-[1440px] px-4 pt-6 transition-opacity duration-500 sm:px-8 sm:pt-9 ${
          detail ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <h1 id="colecao-title" className="type-brand text-[clamp(1.75rem,3.6vw,2.75rem)] leading-tight text-cream">
          A coleção
        </h1>
        {count > 0 ? (
          <p className="mt-2 max-w-md text-sm text-cream/75">Direto da prateleira do estábulo. Escolha um boné para ver de perto.</p>
        ) : null}
      </div>

      {count === 0 ? (
        <div className="relative z-10 mx-auto mt-16 max-w-md px-4 text-center">
          <p className="type-brand text-xl text-cream sm:text-2xl">Os primeiros modelos chegam em breve.</p>
          <p className="mt-3 text-sm text-cream/75">Acompanhe os lançamentos no Instagram enquanto a coleção é preparada.</p>
        </div>
      ) : fallback ? (
        <ul className="relative z-10 mx-auto mt-8 grid max-h-[62%] max-w-[1440px] grid-cols-2 gap-4 overflow-y-auto px-4 sm:grid-cols-3 sm:px-8 lg:grid-cols-5" data-lenis-prevent>
          {items.map((item) => {
            const cover = coverOf(item);
            return (
              <li key={item.slug}>
                <Link href={`/produto/${item.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-xs bg-cream">
                    {cover ? (
                      <Image src={cover} alt={item.name} fill sizes="(min-width: 1024px) 18vw, 45vw" className="object-contain p-[9%]" />
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm">{item.name}</p>
                  <p className="tabular text-sm text-cream/75">
                    <StorePrice baseCents={item.priceCents} />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          {/* Um botão de verdade sobre cada boné: mouse, toque e teclado. */}
          <ul aria-label="Bonés da coleção" className={detail ? "hidden" : undefined}>
            {items.map((item, i) => {
              const screen = screens[i];
              const style: CSSProperties = screen
                ? {
                    left: `${screen.hit.left * 100}%`,
                    top: `${screen.hit.top * 100}%`,
                    width: `${screen.hit.width * 100}%`,
                    height: `${screen.hit.height * 100}%`,
                  }
                : { left: 0, top: 0, width: 0, height: 0 };
              return (
                <li key={item.slug}>
                  <button
                    ref={(node) => {
                      hitRefs.current[i] = node;
                    }}
                    type="button"
                    style={style}
                    disabled={!ready}
                    aria-label={`Ver ${item.name} de perto`}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setHovered(i);
                    }}
                    onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered((h) => (h === i ? null : h))}
                    onClick={() => {
                      setHovered(null);
                      setSelected(i);
                    }}
                    className="absolute z-10 rounded-sm disabled:cursor-default"
                  />
                </li>
              );
            })}
          </ul>

          {/* Etiquetas sob as prateleiras: no cursor (ou sempre, nas telas de toque). Entram só
              depois que a câmera volta à parede inteira. */}
          {!detail ? (
            <div className="wall-labels">
              {items.map((item, i) => {
                const screen = screens[i];
                if (!screen) return null;
                return (
                  <p
                    key={item.slug}
                    aria-hidden="true"
                    style={{ left: `${screen.labelX * 100}%`, top: `${screen.labelY * 100}%` }}
                    className={`wall-label pointer-events-none absolute z-10 w-max max-w-[44vw] text-center transition-[opacity,transform] duration-500 ${
                      ready && hovered === i ? "is-on" : ""
                    } ${ready ? "" : "opacity-0"}`}
                  >
                    <span className="type-micro block truncate text-gold-light">{item.name}</span>
                    <span className="tabular mt-0.5 block text-xs text-cream/80">
                      <StorePrice baseCents={item.priceCents} />
                    </span>
                  </p>
                );
              })}
            </div>
          ) : null}
        </>
      )}

      {detail && selected !== null ? (
        <CollectionDetail
          key={detail.slug}
          item={detail}
          index={selected}
          total={count}
          onBack={close}
          onPrev={() => setSelected((s) => (s === null ? s : (s - 1 + count) % count))}
          onNext={() => setSelected((s) => (s === null ? s : (s + 1) % count))}
          onCover={(url) => onCover(selected, url)}
        />
      ) : null}

      <div
        ref={barRef}
        className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-3"
      >
        <p className={`type-micro whitespace-nowrap text-cream/75 ${count === 0 ? "invisible" : ""}`}>
          <span className="hidden sm:inline">
            Coleção 01 <span aria-hidden="true">·</span>{" "}
          </span>
          {pad(count)} {count === 1 ? "modelo" : "modelos"}
        </p>
        <p className={`type-micro hidden text-cream/75 ${count > 0 && !fallback ? "lg:block" : ""}`} aria-live="polite">
          {detail ? "Arraste para girar. Esc volta à parede." : "Passe o cursor para iluminar. Clique para ver de perto."}
        </p>
        <Link
          href="/loja"
          className="type-micro inline-flex min-h-12 items-center gap-2 whitespace-nowrap text-cream/90 transition-colors hover:text-gold-light"
        >
          Ver todos<span className="hidden sm:inline"> os modelos</span> <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
