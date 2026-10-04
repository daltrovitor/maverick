// Hello World
import { VIRAWEB_SYMBOL_ID } from "@/components/brand/BrandSprites";
import { VIRAWEB_VIEWBOX } from "@/components/brand/marks";

export interface ViraWebLogoProps {
  readonly className?: string;
  readonly title?: string;
}

/** Emblema oficial ViraWeb (13 polígonos) — referencia o símbolo do sprite global. */
export function ViraWebLogo({ className, title }: ViraWebLogoProps) {
  const labelled = Boolean(title);
  return (
    <svg
      viewBox={VIRAWEB_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={labelled ? "img" : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <use href={`#${VIRAWEB_SYMBOL_ID}`} x={0} y={0} width={766} height={621} />
    </svg>
  );
}
