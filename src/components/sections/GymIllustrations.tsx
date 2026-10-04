// Hello World
import { MaverickMonogram } from "@/components/brand/MaverickMonogram";
import { CapIllustration } from "@/components/cap/CapIllustration";
import type { GymItemId } from "@/lib/gym";

const INK = "#1f1612";
const FABRIC = "#2b2522";
const STITCH = "#4a433d";

function Tee() {
  return (
    <svg viewBox="0 0 240 210" className="h-auto w-full" aria-hidden="true" focusable="false">
      <path
        d="M58 34 L96 18 C104 30 136 30 144 18 L182 34 L214 82 L180 98 L178 196 L62 196 L60 98 L26 82 Z"
        fill={FABRIC}
      />
      <path d="M96 18 C104 30 136 30 144 18" fill="none" stroke={STITCH} strokeWidth="2" />
      <path d="M60 98 L62 196 M178 98 L176 196" fill="none" stroke={STITCH} strokeWidth="1" strokeDasharray="3 3" />
      <MaverickMonogram x={100} y={54} width={40} height={34} color="#d4af37" background={FABRIC} />
      <text x="120" y="104" textAnchor="middle" fill="#d4af37" fontSize="9" letterSpacing="3" fontFamily="var(--font-instrument), Georgia, serif">
        MAVERICK
      </text>
    </svg>
  );
}

function Shorts() {
  return (
    <svg viewBox="0 0 240 210" className="h-auto w-full" aria-hidden="true" focusable="false">
      <path d="M54 30 L186 30 L200 168 L132 176 L120 96 L108 176 L40 168 Z" fill={FABRIC} />
      <rect x="54" y="30" width="132" height="14" fill={INK} />
      <path d="M120 44 L120 96" stroke={STITCH} strokeWidth="1.5" />
      <path d="M176 70 L188 150" stroke={STITCH} strokeWidth="1" strokeDasharray="3 3" />
      <MaverickMonogram x={64} y={136} width={20} height={17} color="#d4af37" background={FABRIC} />
    </svg>
  );
}

function Tank() {
  return (
    <svg viewBox="0 0 240 210" className="h-auto w-full" aria-hidden="true" focusable="false">
      <path
        d="M86 16 C94 44 146 44 154 16 L164 16 C162 52 178 70 184 96 L180 196 L60 196 L56 96 C62 70 78 52 76 16 Z"
        fill={FABRIC}
      />
      <path d="M86 16 C94 44 146 44 154 16" fill="none" stroke={STITCH} strokeWidth="2" />
      <MaverickMonogram x={102} y={80} width={36} height={31} color="#d4af37" background={FABRIC} />
    </svg>
  );
}

export function GymIllustration({ id }: { id: GymItemId }) {
  switch (id) {
    case "camiseta":
      return <Tee />;
    case "bermuda":
      return <Shorts />;
    case "regata":
      return <Tank />;
    case "dryfit":
      return <CapIllustration edition="black" style="snapback" idPrefix="gym-dryfit" className="h-auto w-full" />;
  }
}
