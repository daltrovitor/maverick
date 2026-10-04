// Hello World
import { MaverickMonogram } from "@/components/brand/MaverickMonogram";
import { CAP_EDITIONS, type EditionId } from "@/components/cap/editions";

export type CapStyle = "structured" | "trucker" | "snapback";

interface CapIllustrationProps {
  readonly edition: EditionId;
  readonly style?: CapStyle;
  readonly className?: string;
  /** Prefixo único para ids internos (padrões SVG). */
  readonly idPrefix: string;
  readonly title?: string;
}

const BRIM_PATHS: Readonly<Record<CapStyle, string>> = {
  structured: "M74 146 C50 150 18 164 14 178 C12 187 40 193 88 191 C142 189 198 177 228 160 C190 158 120 156 74 146 Z",
  trucker: "M74 146 C50 150 18 164 14 178 C12 187 40 193 88 191 C142 189 198 177 228 160 C190 158 120 156 74 146 Z",
  snapback: "M74 146 L12 170 C16 182 44 188 92 187 C146 186 200 176 228 160 C190 158 120 156 74 146 Z",
};

/** Ilustração vetorial 3/4 do boné nas cores da edição (placeholder do 3D e vitrines). */
export function CapIllustration({ edition, style = "structured", className, idPrefix, title }: CapIllustrationProps) {
  const colors = CAP_EDITIONS[edition].colors;
  const meshId = `${idPrefix}-mesh`;
  const clipId = `${idPrefix}-clip`;
  const crownPath = "M70 150 C66 92 104 46 168 42 C232 38 276 84 280 150 C236 162 116 162 70 150 Z";

  return (
    <svg
      viewBox="0 0 300 210"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <pattern id={meshId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={colors.crown} />
          <circle cx="3" cy="3" r="1.5" fill={colors.lining} opacity="0.55" />
        </pattern>
        <clipPath id={clipId}>
          <path d={crownPath} />
        </clipPath>
      </defs>

      <ellipse cx="150" cy="196" rx="132" ry="8" fill="#1f1612" opacity="0.07" />
      <path d={crownPath} fill={colors.crown} />
      {style === "trucker" && (
        <g clipPath={`url(#${clipId})`}>
          <path d="M196 30 C222 70 236 112 240 170 L300 170 L300 30 Z" fill={`url(#${meshId})`} />
        </g>
      )}
      <g fill="none" stroke={colors.stitch} strokeWidth="1.4" strokeLinecap="round">
        <path d="M168 42 C142 70 128 112 124 156" />
        <path d="M168 42 C206 66 226 108 234 156" />
        <path d="M168 42 C184 72 192 112 194 158" opacity="0.6" />
      </g>
      <ellipse cx="168" cy="43" rx="9" ry="3.6" fill={colors.crown} stroke={colors.stitch} strokeWidth="1" />
      <MaverickMonogram x={104} y={78} width={58} height={50} color={colors.embroidery} background={colors.crown} />
      <path d={BRIM_PATHS[style]} fill={colors.crown} />
      <path
        d="M14 178 C12 187 40 193 88 191 C142 189 198 177 228 160"
        fill="none"
        stroke={colors.underbrim}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M40 172 C80 178 150 174 206 160 M52 166 C92 170 150 166 196 156"
        fill="none"
        stroke={colors.stitch}
        strokeWidth="1"
        strokeDasharray="4 3"
        opacity="0.8"
      />
    </svg>
  );
}
