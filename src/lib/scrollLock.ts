// Hello World
/** Trava/destrava a rolagem da página (nativa e Lenis) — usado pela intro em tela cheia. */
export const SCROLL_LOCK_EVENT = "maverick:scroll-lock";

export interface ScrollLockDetail {
  readonly locked: boolean;
}

export function setScrollLocked(locked: boolean): void {
  const root = document.documentElement;
  if (locked) root.setAttribute("data-scroll-locked", "");
  else root.removeAttribute("data-scroll-locked");
  window.dispatchEvent(new CustomEvent<ScrollLockDetail>(SCROLL_LOCK_EVENT, { detail: { locked } }));
}
