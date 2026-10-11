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
} from "@/components/brand/maverickLogoPaths";

type CSSVars = CSSProperties & Record<`--${string}`, string>;

const SHARD_MS = 1300;
const TONE_MS = 1200;
const LAST_SHARD_MS = Math.max(...MONOGRAM_SHARDS.map((s) => s.delay));
/** Quando o último estilhaço praticamente assentou, o monograma inteiro surge por cima (sem frestas)… */
const SOLID_AT_MS = LAST_SHARD_MS + 950;
/** …e os estilhaços saem de cena logo depois. */
const SHARDS_END_MS = SOLID_AT_MS + 450;

const pct = (v: number) => `${(v * 100).toFixed(4)}%`;

const WORD_TOP = Math.min(...WORDMARK.map((g) => g.y)) - 1;
const WORD_BOTTOM = Math.max(...WORDMARK.map((g) => g.y + g.h)) + 1;
const TAG_CENTER =
  (Math.min(...TAGLINE.map((g) => g.x)) + Math.max(...TAGLINE.map((g) => g.x + g.w))) / 2;

/**
 * Abertura da página inicial, no espírito da entrada da ViraWeb: os estilhaços do monograma
 * entram de fora girando e se encaixam, as letras do nome sobem por máscara, a assinatura se
 * abre a partir do centro e os fios se estendem. Tudo em CSS (começa na primeira pintura, sem
 * esperar o JavaScript); o controlador só cuida da saída, quando o monograma voa até o cabeçalho.
 * Só aparece com `<html data-intro>` (decidido no <head>, ver introGate).
 */
export function BrandIntro() {
  return (
    <div
      className="brand-intro"
      data-brand-intro
      style={
        {
          "--solid-at": `${SOLID_AT_MS}ms`,
          "--shards-end": `${SHARDS_END_MS}ms`,
          "--shard-dur": `${SHARD_MS}ms`,
          "--tone-dur": `${TONE_MS}ms`,
        } as CSSVars
      }
    >
      <div className="brand-intro__bg" />

      <div className="brand-intro__logo" style={{ aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}` }} aria-hidden="true">
        <div
          className="brand-intro__mark"
          data-intro-mark
          style={{
            left: pct(MONOGRAM_BOX.x / LOGO_BOX.w),
            top: pct(MONOGRAM_BOX.y / LOGO_BOX.h),
            width: pct(MONOGRAM_BOX.w / LOGO_BOX.w),
          }}
        >
          <svg viewBox={`0 0 ${MONOGRAM_BOX.w} ${MONOGRAM_BOX.h}`} focusable="false">
            <defs>
              <path id="intro-monogram" d={MONOGRAM_PATH} fillRule="evenodd" />
              {MONOGRAM_SHARDS.map((shard, i) => (
                <clipPath id={`intro-shard-${i}`} key={shard.points}>
                  <polygon points={shard.points} />
                </clipPath>
              ))}
            </defs>
            <g className="intro-shards">
              {MONOGRAM_SHARDS.map((shard, i) => (
                <g
                  key={shard.points}
                  className="intro-shard"
                  style={
                    {
                      "--dx": `${shard.dx}px`,
                      "--dy": `${shard.dy}px`,
                      "--rot": `${shard.rot}deg`,
                      "--delay": `${shard.delay}ms`,
                      "--tone": shard.tone,
                      "--ox": `${shard.cx}px`,
                      "--oy": `${shard.cy}px`,
                    } as CSSVars
                  }
                >
                  <use href="#intro-monogram" clipPath={`url(#intro-shard-${i})`} />
                </g>
              ))}
            </g>
            <use href="#intro-monogram" className="intro-solid" />
          </svg>
        </div>

        <svg className="brand-intro__type" viewBox={`0 0 ${LOGO_BOX.w} ${LOGO_BOX.h}`} focusable="false">
          <clipPath id="intro-wordmark-mask">
            <rect x="0" y={WORD_TOP} width={LOGO_BOX.w} height={WORD_BOTTOM - WORD_TOP} />
          </clipPath>
          <g className="intro-type" fillRule="evenodd">
            <g clipPath="url(#intro-wordmark-mask)">
              {WORDMARK.map((glyph, i) => (
                <path key={glyph.name} className="intro-rise" d={glyph.d} style={{ "--delay": `${i * 55}ms` } as CSSVars} />
              ))}
            </g>
            <path className="intro-reg" d={REGISTERED.d} />
            {TAGLINE.map((glyph, i) => (
              <path
                key={`${glyph.name}-${i}`}
                className="intro-track"
                d={glyph.d}
                style={{ "--tx": `${((TAG_CENTER - (glyph.x + glyph.w / 2)) * 0.42).toFixed(2)}px` } as CSSVars}
              />
            ))}
            {RULES.map((rule, i) => (
              <rect
                key={rule.x}
                className={`intro-rule ${i === 0 ? "intro-rule--left" : "intro-rule--right"}`}
                x={rule.x}
                y={rule.y}
                width={rule.w}
                height={rule.h}
              />
            ))}
            {FOUNDED.map((glyph, i) => (
              <path
                key={`${glyph.name}-${i}`}
                className="intro-founded"
                d={glyph.d}
                style={{ "--delay": `${i * 35}ms` } as CSSVars}
              />
            ))}
          </g>
        </svg>
      </div>

      <BrandIntroController />
    </div>
  );
}
