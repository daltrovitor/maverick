// Hello World
import type { CSSProperties } from "react";

/**
 * Logo oficial da Maverick (vetorizado do arquivo fornecido pela marca).
 * Renderizado por máscara CSS: a cor segue `currentColor`, então funciona em fundo claro
 * (café) e escuro (creme) sem duplicar arquivos.
 */
const VARIANTS = {
  monogram: { src: "/brand/maverick-monogram.svg", ratio: 940 / 675 },
  full: { src: "/brand/maverick-logo.svg", ratio: 2334 / 1260 },
} as const;

export interface MaverickLogoProps {
  readonly variant?: keyof typeof VARIANTS;
  readonly className?: string;
  /** Rótulo acessível; omita quando houver texto visível ao lado. */
  readonly title?: string;
}

export function MaverickLogo({ variant = "monogram", className, title }: MaverickLogoProps) {
  const { src, ratio } = VARIANTS[variant];
  const style: CSSProperties = {
    aspectRatio: String(ratio),
    backgroundColor: "currentColor",
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
  return (
    <span
      className={`inline-block ${className ?? ""}`}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
