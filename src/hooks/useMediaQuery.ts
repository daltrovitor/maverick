// Hello World
"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Assina uma media query do navegador. No servidor (e durante a hidratação) devolve
 * `serverValue`, então o HTML é estável; logo depois o cliente passa a refletir a preferência.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
