// Hello World
import type { CSSProperties } from "react";
import { BrandIntroController } from "@/components/brand/BrandIntroController";
import { LOGO_BOX, MONOGRAM_BOX } from "@/components/brand/maverickLogoGeometry";
import {
  FOUNDED,
  MONOGRAM_PATH,
  MONOGRAM_SHARDS,
  REGISTERED,
  RULES,
  TAGLINE,
  WORDMARK,
  type LogoGlyph,
} from "@/components/brand/maverickLogoPaths";

type CSSVars = CSSProperties & Record<`--${string}`, string>;

/*
 * Ritmo da abertura (ms desde a primeira pintura), em três tempos que se sobrepõem de leve:
 * o monograma se monta, o nome sobe letra a letra e, por fim, a assinatura se abre.
 */
/** Os atrasos gerados pelo script são esticados: os estilhaços chegam um a um, sem atropelo. */
const SHARD_PACE = 1.6;
const SHARD_MS = 1600;
const INK_MS = 1300;
const LAST_SHARD_MS = Math.max(...MONOGRAM_SHARDS.map((s) => s.delay)) * SHARD_PACE;
/** Quando o último estilhaço praticamente assentou, o monograma inteiro surge por cima (sem frestas)… */
const SOLID_AT_MS = Math.round(LAST_SHARD_MS + 1100);
/** …e os estilhaços saem de cena logo depois. */
const SHARDS_END_MS = SOLID_AT_MS + 500;
const WORD_AT_MS = 1150;
const WORD_STEP_MS = 80;
const REG_AT_MS = 2100;
const TAG_AT_MS = 1850;
const RULE_AT_MS = 2050;
const YEAR_AT_MS = 2250;
const YEAR_STEP_MS = 40;

const pct = (v: number) => `${(v * 100).toFixed(4)}%`;

interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Posição de uma caixa (unidades do logo) dentro de um quadro, em porcentagem. */
function place(box: Frame, frame: Frame): CSSProperties {
  return {
    left: pct((box.x - frame.x) / frame.w),
    top: pct((box.y - frame.y) / frame.h),
    width: pct(box.w / frame.w),
    height: pct(box.h / frame.h),
  };
}

const LOGO_FRAME: Frame = { x: 0, y: 0, ...LOGO_BOX };
const MONOGRAM_FRAME: Frame = { x: 0, y: 0, w: MONOGRAM_BOX.w, h: MONOGRAM_BOX.h };

const WORD_TOP = Math.min(...WORDMARK.map((g) => g.y)) - 1;
const WORD_BOTTOM = Math.max(...WORDMARK.map((g) => g.y + g.h)) + 1;
const WORD_FRAME: Frame = { x: 0, y: WORD_TOP, w: LOGO_BOX.w, h: WORD_BOTTOM - WORD_TOP };
const TAG_CENTER =
  (Math.min(...TAGLINE.map((g) => g.x)) + Math.max(...TAGLINE.map((g) => g.x + g.w))) / 2;

/** Cada estilhaço vira uma camada do tamanho do próprio triângulo (pouca memória de GPU). */
const SHARDS = MONOGRAM_SHARDS.map((shard) => {
  const points = shard.points.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const box: Frame = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  return {
    shard,
    box,
    origin: `${pct((shard.cx - x) / box.w)} ${pct((shard.cy - y) / box.h)}`,
    glint: shard.tone.toLowerCase() === "#b88a2e",
  };
});

/** Uma peça do logo numa camada própria; o SVG mostra só a caixa dela. */
function Glyph({
  glyph,
  frame,
  className,
  style,
}: {
  readonly glyph: LogoGlyph;
  readonly frame: Frame;
  readonly className: string;
  readonly style?: CSSVars;
}) {
  return (
    <div className={`intro-layer ${className}`} style={{ ...place(glyph, frame), ...style }}>
      <svg viewBox={`${glyph.x} ${glyph.y} ${glyph.w} ${glyph.h}`} preserveAspectRatio="none" focusable="false">
        <path d={glyph.d} fillRule="evenodd" />
      </svg>
    </div>
  );
}

/**
 * Abertura da página inicial, no espírito da entrada da ViraWeb: os estilhaços do monograma
 * entram de fora girando e se encaixam, as letras do nome sobem por máscara, a assinatura se
 * abre a partir do centro e os fios se estendem.
 *
 * Cada peça é uma camada HTML animada só com `transform` e `opacity` (em CSS, desde a primeira
 * pintura): o navegador entrega tudo à GPU, então a abertura segue lisa mesmo enquanto a página
 * hidrata por trás. O controlador só cuida da saída, quando o monograma voa até o cabeçalho.
 * Só aparece com `<html data-intro>` (decidido no <head>, ver introGate).
 */
export function BrandIntro() {
  return (
    <div
      className="brand-intro"
      data-brand-intro
      data-lenis-prevent
      style={
        {
          "--solid-at": `${SOLID_AT_MS}ms`,
          "--shards-end": `${SHARDS_END_MS}ms`,
          "--shard-dur": `${SHARD_MS}ms`,
          "--ink-dur": `${INK_MS}ms`,
        } as CSSVars
      }
    >
      <div className="brand-intro__bg" />

      {/* O traço do monograma, uma vez só; cada camada o reaproveita com <use>. */}
      <svg className="brand-intro__defs" aria-hidden="true" focusable="false">
        <defs>
          <path id="intro-monogram" d={MONOGRAM_PATH} fillRule="evenodd" />
          {SHARDS.map(({ shard }, i) => (
            <clipPath id={`intro-shard-${i}`} key={shard.points}>
              <polygon points={shard.points} />
            </clipPath>
          ))}
        </defs>
      </svg>

      <div
        className="brand-intro__logo"
        style={{ aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}`, "--u": `calc(var(--logo-w) / ${LOGO_BOX.w})` } as CSSVars}
        aria-hidden="true"
      >
        <div className="brand-intro__mark" data-intro-mark style={place(MONOGRAM_BOX, LOGO_FRAME)}>
          <div className="intro-shards">
            {SHARDS.map(({ shard, box, origin, glint }, i) => {
              const viewBox = `${box.x} ${box.y} ${box.w} ${box.h}`;
              return (
                <div
                  key={shard.points}
                  className="intro-layer intro-shard"
                  style={
                    {
                      ...place(box, MONOGRAM_FRAME),
                      "--dx": String(shard.dx),
                      "--dy": String(shard.dy),
                      "--rot": `${shard.rot}deg`,
                      "--at": `${Math.round(shard.delay * SHARD_PACE)}ms`,
                      "--origin": origin,
                    } as CSSVars
                  }
                >
                  <svg viewBox={viewBox} preserveAspectRatio="none" focusable="false">
                    <use href="#intro-monogram" clipPath={`url(#intro-shard-${i})`} />
                  </svg>
                  {glint ? (
                    <svg className="intro-glint" viewBox={viewBox} preserveAspectRatio="none" focusable="false" style={{ fill: shard.tone }}>
                      <use href="#intro-monogram" clipPath={`url(#intro-shard-${i})`} />
                    </svg>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="intro-layer intro-solid" style={{ inset: 0 }}>
            <svg viewBox={`0 0 ${MONOGRAM_BOX.w} ${MONOGRAM_BOX.h}`} preserveAspectRatio="none" focusable="false">
              <use href="#intro-monogram" />
            </svg>
          </div>
        </div>

        <div className="brand-intro__type">
          <div className="intro-mask" style={place(WORD_FRAME, LOGO_FRAME)}>
            {WORDMARK.map((glyph, i) => (
              <Glyph
                key={glyph.name}
                glyph={glyph}
                frame={WORD_FRAME}
                className="intro-rise"
                style={{ "--at": `${WORD_AT_MS + i * WORD_STEP_MS}ms` }}
              />
            ))}
          </div>
          <Glyph glyph={REGISTERED} frame={LOGO_FRAME} className="intro-reg" style={{ "--at": `${REG_AT_MS}ms` }} />
          {TAGLINE.map((glyph, i) => (
            <Glyph
              key={`${glyph.name}-${i}`}
              glyph={glyph}
              frame={LOGO_FRAME}
              className="intro-track"
              style={{
                "--at": `${TAG_AT_MS}ms`,
                "--tx": ((TAG_CENTER - (glyph.x + glyph.w / 2)) * 0.42).toFixed(2),
              }}
            />
          ))}
          {RULES.map((rule, i) => (
            <div
              key={rule.x}
              className={`intro-layer intro-rule ${i === 0 ? "intro-rule--left" : "intro-rule--right"}`}
              style={{ ...place(rule, LOGO_FRAME), "--at": `${RULE_AT_MS}ms` } as CSSVars}
            />
          ))}
          {FOUNDED.map((glyph, i) => (
            <Glyph
              key={`${glyph.name}-${i}`}
              glyph={glyph}
              frame={LOGO_FRAME}
              className="intro-founded"
              style={{ "--at": `${YEAR_AT_MS + i * YEAR_STEP_MS}ms` }}
            />
          ))}
        </div>
      </div>

      <BrandIntroController />
    </div>
  );
}
