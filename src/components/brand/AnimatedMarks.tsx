// Hello World
import type { CSSProperties } from "react";
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

const order = (index: number) => ({ "--i": index }) as CSSProperties;

interface AnimatedMarkProps {
  readonly className?: string;
  readonly title: string;
}

/**
 * Emblema ViraWeb montado polígono a polígono. As animações vêm do CSS (.mark-polygon),
 * então os atrasos são definidos pelo contêiner (hero ou intro).
 */
export function AnimatedViraWebMark({ className, title }: AnimatedMarkProps) {
  return (
    <svg viewBox={VIRAWEB_VIEWBOX} className={className} role="img" aria-label={title}>
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
  );
}

/** Monograma Maverick: traço vetorial desenhado (stroke-dasharray) e preenchimento revelado em seguida. */
export function AnimatedMaverickMark({
  className,
  title,
  color = "#1f1612",
  background = "#faf6f0",
}: AnimatedMarkProps & { readonly color?: string; readonly background?: string }) {
  return (
    <svg viewBox={MAVERICK_VIEWBOX} className={className} role="img" aria-label={title}>
      <g className="mark-fill">
        <g fill={color}>
          {MAVERICK_M_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill={background} stroke={background} strokeWidth={HORSE_HALO_WIDTH} strokeLinejoin="round">
          <g transform={HORSE_TRANSFORM_ATTR}>
            {HORSE_HEAD_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path d={HORSE_NECK_PATH} />
        </g>
        <g fill={color}>
          <g transform={HORSE_TRANSFORM_ATTR}>
            {HORSE_HEAD_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path d={HORSE_NECK_PATH} />
        </g>
        <g transform={HORSE_TRANSFORM_ATTR} fill="none" stroke={background} strokeWidth={2.2} strokeLinecap="round">
          {HORSE_DETAIL_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <ellipse
          cx={HORSE_EYE.cx}
          cy={HORSE_EYE.cy}
          rx={HORSE_EYE.rx}
          ry={HORSE_EYE.ry}
          fill={background}
          transform={`rotate(${HORSE_EYE.rotate} ${HORSE_EYE.cx} ${HORSE_EYE.cy})`}
        />
      </g>
      <g className="mark-stroke" fill="none" stroke={color} strokeWidth={1.1} strokeLinejoin="round" aria-hidden="true">
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
  );
}
