// Hello World
import type { CSSProperties } from "react";
import { MAVERICK_SYMBOL_ID } from "@/components/brand/BrandSprites";
import { MAVERICK_VIEWBOX, MAVERICK_VIEWBOX_RECT } from "@/components/brand/marks";

export interface MaverickMonogramProps {
  readonly className?: string;
  /** Cor do monograma. */
  readonly color?: string;
  /** Cor do fundo sobre o qual a marca aparece (usada no recorte do cavalo). */
  readonly background?: string;
  /** Nome acessível; quando omitido, a marca é decorativa. */
  readonly title?: string;
  /** Posicionamento quando aninhado dentro de outro SVG. */
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

/** Monograma Maverick (Server Component) — referencia o símbolo do sprite global. */
export function MaverickMonogram({
  className,
  color = "#1f1612",
  background = "#ffffff",
  title,
  x,
  y,
  width,
  height,
}: MaverickMonogramProps) {
  const labelled = Boolean(title);
  const style = { "--mv-ink": color, "--mv-bg": background } as CSSProperties;
  return (
    <svg
      viewBox={MAVERICK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      x={x}
      y={y}
      width={width}
      height={height}
      role={labelled ? "img" : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <use
        href={`#${MAVERICK_SYMBOL_ID}`}
        x={MAVERICK_VIEWBOX_RECT.x}
        y={MAVERICK_VIEWBOX_RECT.y}
        width={MAVERICK_VIEWBOX_RECT.width}
        height={MAVERICK_VIEWBOX_RECT.height}
      />
    </svg>
  );
}
