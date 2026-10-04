// Hello World
import { MaverickMonogram } from "@/components/brand/MaverickMonogram";
import { ViraWebLogo } from "@/components/brand/ViraWebLogo";

interface LockupProps {
  readonly className?: string;
  /** Exibe a assinatura secundária (oculta em telas estreitas). */
  readonly withTagline?: boolean;
}

export function ViraWebLockup({ className = "", withTagline = false }: LockupProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <ViraWebLogo className="h-7 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-sans text-[15px] font-semibold tracking-tight text-navy">ViraWeb</span>
        {withTagline && (
          <span className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:block">
            Engenharia digital
          </span>
        )}
      </span>
    </span>
  );
}

export function MaverickLockup({ className = "", withTagline = false }: LockupProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <MaverickMonogram className="h-7 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] tracking-[0.22em] text-ink">MAVERICK</span>
        {withTagline && (
          <span className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.14em] text-muted sm:block">
            Headwear &amp; Lifestyle
          </span>
        )}
      </span>
    </span>
  );
}
