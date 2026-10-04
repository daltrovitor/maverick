// Hello World
"use client";

import { useRef, type AnchorHTMLAttributes, type PointerEvent, type ReactNode } from "react";

interface MagneticLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly children: ReactNode;
  readonly strength?: number;
}

/**
 * Link com atração magnética ao cursor. O deslocamento é aplicado via transform e suavizado
 * pela curva de mola em CSS (--ease-spring), sem loop de animação em JavaScript.
 */
export function MagneticLink({ children, strength = 0.25, className = "", style, ...rest }: MagneticLinkProps) {
  const frame = useRef<number | null>(null);

  const move = (element: HTMLElement, x: number, y: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      element.style.transform = x === 0 && y === 0 ? "" : `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
  };

  const handleMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    move(
      event.currentTarget,
      (event.clientX - (rect.left + rect.width / 2)) * strength,
      (event.clientY - (rect.top + rect.height / 2)) * strength,
    );
  };

  return (
    <a
      {...rest}
      style={style}
      className={`magnetic ${className}`}
      onPointerMove={handleMove}
      onPointerLeave={(event) => move(event.currentTarget, 0, 0)}
    >
      {children}
    </a>
  );
}
