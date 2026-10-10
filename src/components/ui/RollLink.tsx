// Hello World
import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Link com rolagem de letras no hover (cada letra sobe e é substituída pela cópia de baixo,
 * em cascata). Só CSS: funciona sem JS e respeita movimento reduzido pelo CSS global.
 */
export function RollLink({
  children,
  className,
  tone = "dark",
  ...rest
}: Omit<ComponentProps<typeof Link>, "children"> & { readonly children: string; readonly tone?: "dark" | "light" }) {
  const letters = Array.from(children);
  const palette =
    tone === "dark" ? "bg-ink text-paper hover:bg-[#3a2616]" : "bg-cream text-ink hover:bg-paper";
  return (
    <Link
      {...rest}
      aria-label={children}
      className={`group/roll inline-flex min-h-14 items-center justify-center rounded-sm px-7 text-[0.95rem] font-medium tracking-[0.02em] transition-colors duration-300 ${palette} ${className ?? ""}`}
    >
      <span aria-hidden="true" className="relative inline-flex overflow-hidden">
        {letters.map((char, i) => (
          <span
            key={i}
            className="relative inline-block transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/roll:-translate-y-full group-focus-visible/roll:-translate-y-full"
            style={{ transitionDelay: `${i * 14}ms` }}
          >
            <span className="block">{char === " " ? " " : char}</span>
            <span className="absolute top-full left-0 block">{char === " " ? " " : char}</span>
          </span>
        ))}
      </span>
    </Link>
  );
}
