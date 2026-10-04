// Hello World
import type { ElementType, ReactNode } from "react";

interface RevealProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly as?: ElementType;
}

/**
 * Marca um grupo para revelação por scroll. A animação é orquestrada por um único
 * ScrollRevealController (GSAP ScrollTrigger), sem custo de hidratação por instância.
 * Filhos com [data-reveal] entram em cascata; sem eles, o grupo inteiro é revelado.
 */
export function Reveal({ children, className, as: Tag = "div" }: RevealProps) {
  return (
    <Tag data-reveal-group="" className={className}>
      {children}
    </Tag>
  );
}
