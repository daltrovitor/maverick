// Hello World
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
type Size = "md" | "lg" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium tracking-[0.01em] select-none " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] " +
  "active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0 aria-disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-[#3a2616] hover:shadow-[0_10px_24px_-12px_rgba(38,23,10,0.6)]",
  secondary: "border border-ink/80 bg-transparent text-ink hover:bg-ink hover:text-paper",
  ghost: "bg-transparent text-ink hover:bg-cream-deep",
  danger: "bg-danger text-white hover:bg-[#8a1f15]",
  light: "bg-cream text-ink hover:bg-paper",
};

// Alvos de toque de no mínimo 48px (sm é reservado a contextos densos do painel).
const SIZES: Record<Size, string> = {
  sm: "min-h-10 px-3.5 text-sm",
  md: "min-h-12 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return [BASE, VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  readonly loading?: boolean;
  readonly children: ReactNode;
}

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

type LinkProps = ComponentProps<typeof Link> & AnchorHTMLAttributes<HTMLAnchorElement>;

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: LinkProps & { readonly variant?: Variant; readonly size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />;
}

export function Spinner({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className ?? ""}`}
    />
  );
}
