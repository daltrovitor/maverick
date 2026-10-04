// Hello World
"use client";

import { Fragment, useEffect, useRef, type CSSProperties } from "react";

type HeadingLevel = "h2" | "h3";

interface KineticHeadingProps {
  readonly text: string;
  readonly as?: HeadingLevel;
  readonly className?: string;
  readonly id?: string;
  /** Palavras destacadas em itálico serifado (pontuação final é ignorada na comparação). */
  readonly emphasis?: readonly string[];
}

const normalize = (value: string) => value.replace(/[.,:;!?]+$/, "");

/**
 * Tipografia cinética mascarada: cada palavra sobe de dentro de uma máscara com a curva
 * da mola (stiffness 300, damping 28) em CSS, disparada por IntersectionObserver.
 * Sem JavaScript, o título aparece normalmente (o estado oculto só é armado no cliente).
 */
export function KineticHeading({ text, as = "h2", className = "", id, emphasis = [] }: KineticHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const Tag = as;
  const words = text.split(" ");
  const emphasized = new Set(emphasis.map(normalize));

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // O primeiro callback do observer informa o estado inicial sem forçar layout:
    // se o título já está visível, nada é escondido; senão, arma e anima ao entrar.
    let initial = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (initial) {
        initial = false;
        if (entry.isIntersecting) observer.disconnect();
        else element.setAttribute("data-armed", "");
        return;
      }
      if (entry.isIntersecting) {
        element.setAttribute("data-inview", "");
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} id={id} className={`kinetic ${className}`}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="kinetic-mask">
            <span
              className={`kinetic-word ${emphasized.has(normalize(word)) ? "italic" : ""}`}
              style={{ "--i": index } as CSSProperties}
            >
              {word}
            </span>
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
