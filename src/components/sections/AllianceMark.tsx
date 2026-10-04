// Hello World
import type { CSSProperties } from "react";
import { PointerParallax } from "@/components/ui/PointerParallax";
import {
  HORSE_DETAIL_PATHS,
  HORSE_EYE,
  HORSE_HALO_WIDTH,
  HORSE_HEAD_PATHS,
  HORSE_NECK_PATH,
  HORSE_TRANSFORM_ATTR,
  MAVERICK_M_PATHS,
  MAVERICK_VIEWBOX,
  VIRAWEB_POLYGONS,
  VIRAWEB_VIEWBOX,
} from "@/components/brand/marks";

const BACKGROUND = "#faf6f0";
const INK = "#1f1612";

const order = (index: number) => ({ "--i": index }) as CSSProperties;

/**
 * Composição de boas-vindas (Server Component): as marcas entram com animações CSS
 * dirigidas por uma curva de mola real, sem depender da hidratação para começar.
 */
export function AllianceMark() {
  return (
    <figure className="w-full">
      <PointerParallax className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-line bg-cream">
        <svg className="absolute inset-0 size-full" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="250" x2="400" y2="250" stroke="#ebe5dc" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="200" y1="0" x2="200" y2="500" stroke="#ebe5dc" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line
            className="mark-line"
            pathLength={1}
            x1="96"
            y1="150"
            x2="304"
            y2="350"
            stroke={INK}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="parallax-layer absolute left-[10%] top-[12%] w-[42%]" data-depth="-10">
          <div className="mark-slide-left">
            <svg viewBox={VIRAWEB_VIEWBOX} className="h-auto w-full" role="img" aria-label="Emblema ViraWeb">
              {VIRAWEB_POLYGONS.map((polygon, index) => (
                <polygon
                  key={polygon.points}
                  className="mark-polygon"
                  style={order(index)}
                  points={polygon.points}
                  fill={polygon.fill}
                  stroke={polygon.fill}
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        </div>

        <span
          aria-hidden="true"
          className="mark-cross absolute left-[calc(50%-24px)] top-[calc(50%-24px)] flex size-12 items-center justify-center rounded-xs border border-line-strong bg-white font-mono text-base text-ink"
        >
          ×
        </span>

        <div className="parallax-layer absolute bottom-[12%] right-[8%] w-[46%]" data-depth="12">
          <div className="mark-slide-right">
            <svg viewBox={MAVERICK_VIEWBOX} className="h-auto w-full" role="img" aria-label="Monograma Maverick">
              <g className="mark-fill">
                <g fill={INK}>
                  {MAVERICK_M_PATHS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
                <g fill={BACKGROUND} stroke={BACKGROUND} strokeWidth={HORSE_HALO_WIDTH} strokeLinejoin="round">
                  <g transform={HORSE_TRANSFORM_ATTR}>
                    {HORSE_HEAD_PATHS.map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </g>
                  <path d={HORSE_NECK_PATH} />
                </g>
                <g fill={INK}>
                  <g transform={HORSE_TRANSFORM_ATTR}>
                    {HORSE_HEAD_PATHS.map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </g>
                  <path d={HORSE_NECK_PATH} />
                </g>
                <g transform={HORSE_TRANSFORM_ATTR} fill="none" stroke={BACKGROUND} strokeWidth={2.2} strokeLinecap="round">
                  {HORSE_DETAIL_PATHS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
                <ellipse
                  cx={HORSE_EYE.cx}
                  cy={HORSE_EYE.cy}
                  rx={HORSE_EYE.rx}
                  ry={HORSE_EYE.ry}
                  fill={BACKGROUND}
                  transform={`rotate(${HORSE_EYE.rotate} ${HORSE_EYE.cx} ${HORSE_EYE.cy})`}
                />
              </g>
              {/* Traço vetorial desenhado via stroke-dasharray antes do preenchimento */}
              <g className="mark-stroke" fill="none" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" aria-hidden="true">
                {MAVERICK_M_PATHS.map((d, index) => (
                  <path key={d} d={d} pathLength={1} style={order(index)} />
                ))}
                <g transform={HORSE_TRANSFORM_ATTR}>
                  {HORSE_HEAD_PATHS.map((d, index) => (
                    <path key={d} d={d} pathLength={1} strokeWidth={1.1 / 0.56} style={order(index + 2)} />
                  ))}
                </g>
                <path d={HORSE_NECK_PATH} pathLength={1} style={order(4)} />
              </g>
            </svg>
          </div>
        </div>

        <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          ViraWeb · Engenharia
        </span>
        <span className="absolute bottom-4 right-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Maverick · Est. 2026
        </span>
      </PointerParallax>
      <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Engenharia de software × Headwear &amp; Lifestyle
      </figcaption>
    </figure>
  );
}
