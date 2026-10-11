// Hello World
import type { CSSProperties } from "react";
import { LOGO_BOX, MONOGRAM_BOX } from "@/components/brand/maverickLogoGeometry";

/**
 * Logo oficial da Maverick (vetorizado do arquivo fornecido pela marca).
 * Renderizado por máscara CSS: a cor segue `currentColor`, então funciona em fundo claro
 * (café) e escuro (creme) sem duplicar arquivos. Proporções vêm do vetorizador (mesmo viewBox).
 */
const VARIANTS = {
  monogram: { src: "/brand/maverick-monogram.svg", ratio: MONOGRAM_BOX.w / MONOGRAM_BOX.h },
  full: { src: "/brand/maverick-logo.svg", ratio: LOGO_BOX.w / LOGO_BOX.h },
} as const;

export interface MaverickLogoProps {
  readonly variant?: keyof typeof VARIANTS;
  readonly className?: string;
  /** Rótulo acessível; omita quando houver texto visível ao lado. */
  readonly title?: string;
  /** Destino do monograma quando a abertura da marca termina (só o do cabeçalho). */
  readonly brandMark?: boolean;
}

export function MaverickLogo({ variant = "monogram", className, title, brandMark }: MaverickLogoProps) {
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
      data-brand-mark={brandMark ? "" : undefined}
    />
  );
}
