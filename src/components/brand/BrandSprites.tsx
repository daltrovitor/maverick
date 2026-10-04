// Hello World
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

export const MAVERICK_SYMBOL_ID = "mv-mark";
export const VIRAWEB_SYMBOL_ID = "vw-mark";

/**
 * Sprite SVG único com as duas marcas. Cada uso vira um <use> de 1 nó,
 * e as cores chegam por variáveis CSS (--mv-ink / --mv-bg), que atravessam o shadow tree do <use>.
 */
export function BrandSprites() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", overflow: "hidden" }}>
      <defs>
        <symbol id={MAVERICK_SYMBOL_ID} viewBox={MAVERICK_VIEWBOX}>
          {/* Subcaminhos separados: unir num único "d" criaria furos onde os sentidos de desenho se opõem. */}
          <g fill="var(--mv-ink, #1f1612)">
            {MAVERICK_M_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <g fill="var(--mv-bg, #ffffff)" stroke="var(--mv-bg, #ffffff)" strokeWidth={HORSE_HALO_WIDTH} strokeLinejoin="round">
            <g transform={HORSE_TRANSFORM_ATTR}>
              {HORSE_HEAD_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <path d={HORSE_NECK_PATH} />
          </g>
          <g fill="var(--mv-ink, #1f1612)">
            <g transform={HORSE_TRANSFORM_ATTR}>
              {HORSE_HEAD_PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <path d={HORSE_NECK_PATH} />
          </g>
          <path
            transform={HORSE_TRANSFORM_ATTR}
            d={HORSE_DETAIL_PATHS.join(" ")}
            fill="none"
            stroke="var(--mv-bg, #ffffff)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <ellipse
            cx={HORSE_EYE.cx}
            cy={HORSE_EYE.cy}
            rx={HORSE_EYE.rx}
            ry={HORSE_EYE.ry}
            fill="var(--mv-bg, #ffffff)"
            transform={`rotate(${HORSE_EYE.rotate} ${HORSE_EYE.cx} ${HORSE_EYE.cy})`}
          />
        </symbol>
        <symbol id={VIRAWEB_SYMBOL_ID} viewBox={VIRAWEB_VIEWBOX}>
          {VIRAWEB_POLYGONS.map((polygon) => (
            <polygon
              key={polygon.points}
              points={polygon.points}
              fill={polygon.fill}
              stroke={polygon.fill}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ))}
        </symbol>
      </defs>
    </svg>
  );
}
