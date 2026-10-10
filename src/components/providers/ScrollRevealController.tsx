// Hello World
"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Orquestrador único das revelações: roda no frame seguinte à hidratação, lê o layout uma
 * única vez, esconde apenas o que está abaixo da dobra e cria um ScrollTrigger por grupo.
 */
export function ScrollRevealController() {
  const scope = useRef<HTMLSpanElement>(null);
  // Navegações do App Router trocam a página sem remontar o layout: reprocessa a cada rota.
  const pathname = usePathname();

  useGSAP(
    (context, contextSafe) => {
      if (!contextSafe) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const setup = contextSafe(() => {
        const groups = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal-group]"));
        // Uma única leitura de layout para todos os grupos, antes de qualquer escrita.
        const fold = window.innerHeight * 0.92;
        const pending = groups
          .filter((group) => group.getBoundingClientRect().top > fold)
          .map((group) => {
            const items = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]"));
            return { group, items: items.length > 0 ? items : [group] };
          });
        if (pending.length === 0) return;

        gsap.set(
          pending.flatMap((entry) => entry.items),
          { autoAlpha: 0, y: 28 },
        );
        // Um ScrollTrigger por grupo (não por item): poucas medições, cascata dentro do grupo.
        for (const { group, items } of pending) {
          ScrollTrigger.create({
            trigger: group,
            start: "top 88%",
            once: true,
            onEnter: () => {
              gsap.to(items, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, overwrite: true });
            },
          });
        }
      });

      const frame = requestAnimationFrame(setup);
      return () => cancelAnimationFrame(frame);
    },
    { scope, dependencies: [pathname], revertOnUpdate: true },
  );

  return <span ref={scope} hidden />;
}
