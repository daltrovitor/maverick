// Hello World
import { VIRAWEB_POLYGONS, VIRAWEB_VIEWBOX } from "@/components/brand/viraweb-polygons";

/** Emblema da ViraWeb para o crédito discreto do rodapé. Decorativo (o texto ao lado nomeia). */
export function ViraWebMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox={VIRAWEB_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      {VIRAWEB_POLYGONS.map((p) => (
        <polygon key={p.points} points={p.points} fill={p.fill} />
      ))}
    </svg>
  );
}
