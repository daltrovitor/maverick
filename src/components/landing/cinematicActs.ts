// Hello World
import type { AnchorId, FocusId, Rig } from "@/components/cap/CapStage";

/** Uma tomada: estado da câmera/luz num instante da rolagem (0..1). */
export interface Shot {
  readonly at: number;
  readonly az: number;
  readonly el: number;
  readonly dist: number;
  readonly focus: FocusId;
  readonly key: number;
  readonly fill: number;
  readonly rim: number;
  readonly exposure: number;
  /** Composição: deslocamento do produto (desktop). No celular o texto fica embaixo. */
  readonly frameX: number;
  /** Curva de chegada a esta tomada. */
  readonly ease: "inOut" | "out" | "in" | "linear";
}

export interface Annotation {
  readonly anchor: AnchorId;
  readonly label: string;
  readonly side: "left" | "right";
}

export interface Act {
  readonly id: string;
  /** Faixa da rolagem (0..1) em que o texto do ato fica visível. */
  readonly range: readonly [number, number];
  /** Palavra monumental do plano de fundo (composição tríptica). */
  readonly word: string;
  /** Rótulo curto no índice de capítulos. */
  readonly nav: string;
  readonly title: string;
  readonly text: string;
  readonly annotations: readonly Annotation[];
}

/*
 * Roteiro em oito atos. Os textos descrevem apenas o que as fotos mostram (formas, cores,
 * posições); nenhuma alegação de material, fabricação ou origem.
 */
export const ACTS: readonly Act[] = [
  {
    id: "atmosfera",
    range: [0, 0.11],
    word: "Maverick",
    nav: "Abertura",
    title: "Curadoria em headwear.",
    text: "Um boné de seis gomos, apresentado peça por peça. Role devagar.",
    annotations: [],
  },
  {
    id: "revelacao",
    range: [0.12, 0.235],
    word: "Presença",
    nav: "O boné",
    title: "Preto, fosco, sem excessos.",
    text: "A copa baixa e arredondada aparece por inteiro, sob luz de estúdio.",
    annotations: [],
  },
  {
    id: "frente",
    range: [0.245, 0.355],
    word: "Bordado",
    nav: "Frente",
    title: "O bordado na frente.",
    text: "O jogador de polo bordado em branco, logo ao lado da costura central.",
    annotations: [{ anchor: "pony", label: "Bordado frontal", side: "right" }],
  },
  {
    id: "materia",
    range: [0.365, 0.475],
    word: "Aba",
    nav: "Aba",
    title: "Aba curva, pespontos paralelos.",
    text: "Fileiras de pesponto acompanham a borda da aba pré-curvada.",
    annotations: [{ anchor: "brim", label: "Pespontos da aba", side: "right" }],
  },
  {
    id: "lateral",
    range: [0.485, 0.615],
    word: "Gomos",
    nav: "Lateral",
    title: "Seis gomos, ilhoses bordados.",
    text: "As costuras dividem a copa em seis gomos, cada um com seu ilhós bordado.",
    annotations: [
      { anchor: "eyelet", label: "Ilhós bordado", side: "right" },
      { anchor: "seam", label: "Costura entre gomos", side: "left" },
    ],
  },
  {
    id: "traseira",
    range: [0.625, 0.765],
    word: "Traseira",
    nav: "Traseira",
    title: "Por trás, os acabamentos.",
    text: "Abertura com tira de ajuste, fivela dourada e o bordado POLO no gomo de trás.",
    annotations: [
      { anchor: "polo", label: "Bordado POLO", side: "left" },
      { anchor: "buckle", label: "Fivela dourada", side: "right" },
      { anchor: "strap", label: "Tira de ajuste", side: "left" },
    ],
  },
  {
    id: "360",
    range: [0.775, 0.885],
    word: "360°",
    nav: "360°",
    title: "Por inteiro.",
    text: "Uma volta completa. Arraste para girar quando quiser; a rolagem retoma o percurso.",
    annotations: [],
  },
  {
    id: "colecao",
    range: [0.895, 1.01],
    word: "Coleção",
    nav: "Coleção",
    title: "Seu próximo boné.",
    text: "Estilos diferentes. Algo em comum. Veja os modelos disponíveis na loja.",
    annotations: [],
  },
];

const TURN = Math.PI * 2;

/** Tomadas de câmera (o percurso completo, com respiros de contemplação). */
export const SHOTS: readonly Shot[] = [
  // Ato 1 — atmosfera: silhueta com luz de recorte, aproximação lenta.
  { at: 0, az: -0.8, el: 0.3, dist: 1.6, focus: "center", key: 0.22, fill: 0.12, rim: 1.35, exposure: 0.82, frameX: 0.24, ease: "linear" },
  { at: 0.09, az: -0.6, el: 0.26, dist: 1.32, focus: "center", key: 0.55, fill: 0.3, rim: 1.15, exposure: 0.9, frameX: 0.22, ease: "inOut" },
  // Ato 2 — revelação: a luz sobe e a câmera chega à frente.
  { at: 0.15, az: -0.36, el: 0.24, dist: 1.1, focus: "center", key: 1, fill: 0.62, rim: 0.95, exposure: 1, frameX: 0.2, ease: "inOut" },
  { at: 0.225, az: 0, el: 0.21, dist: 1, focus: "center", key: 1.02, fill: 0.72, rim: 0.82, exposure: 1.02, frameX: 0.18, ease: "inOut" },
  // Ato 3 — frente: aproximação do bordado e leve órbita de contemplação.
  { at: 0.28, az: 0.06, el: 0.14, dist: 0.6, focus: "pony", key: 1.08, fill: 0.78, rim: 0.7, exposure: 1.03, frameX: 0.24, ease: "inOut" },
  { at: 0.345, az: 0.2, el: 0.11, dist: 0.52, focus: "pony", key: 1.1, fill: 0.8, rim: 0.7, exposure: 1.03, frameX: 0.24, ease: "linear" },
  // Ato 4 — matéria: plano alto sobre a aba e seus pespontos.
  { at: 0.41, az: 0.42, el: 0.78, dist: 0.62, focus: "brim", key: 1.12, fill: 0.7, rim: 0.6, exposure: 1.04, frameX: 0.26, ease: "inOut" },
  { at: 0.465, az: 0.68, el: 0.6, dist: 0.56, focus: "brim", key: 1.12, fill: 0.7, rim: 0.65, exposure: 1.04, frameX: 0.26, ease: "linear" },
  // Ato 5 — lateral: recua e percorre o perfil (gomos, ilhoses, costuras).
  { at: 0.52, az: 1.2, el: 0.22, dist: 0.95, focus: "center", key: 1, fill: 0.72, rim: 0.85, exposure: 1.02, frameX: 0.24, ease: "inOut" },
  { at: 0.575, az: 1.6, el: 0.2, dist: 0.8, focus: "eyelet", key: 1.02, fill: 0.72, rim: 0.9, exposure: 1.02, frameX: 0.26, ease: "inOut" },
  { at: 0.615, az: 2.05, el: 0.22, dist: 0.9, focus: "center", key: 1, fill: 0.7, rim: 0.95, exposure: 1.02, frameX: 0.24, ease: "inOut" },
  // Ato 6 — traseira: POLO, depois a fivela com brilho metálico.
  { at: 0.665, az: 2.8, el: 0.3, dist: 0.74, focus: "polo", key: 1.02, fill: 0.7, rim: 1, exposure: 1.02, frameX: 0.24, ease: "inOut" },
  { at: 0.71, az: 3.08, el: 0.24, dist: 0.56, focus: "polo", key: 1.05, fill: 0.72, rim: 1.05, exposure: 1.03, frameX: 0.26, ease: "linear" },
  { at: 0.755, az: 3.45, el: 0.12, dist: 0.46, focus: "buckle", key: 1.15, fill: 0.7, rim: 1.45, exposure: 1.04, frameX: 0.28, ease: "inOut" },
  // Ato 7 — 360°: recua e dá uma volta completa.
  { at: 0.79, az: 3.65, el: 0.26, dist: 1.05, focus: "center", key: 1, fill: 0.72, rim: 0.9, exposure: 1.02, frameX: 0.16, ease: "inOut" },
  { at: 0.88, az: 3.65 + TURN, el: 0.24, dist: 1.05, focus: "center", key: 1, fill: 0.72, rim: 0.9, exposure: 1.02, frameX: 0.16, ease: "linear" },
  // Ato 8 — encerramento: o melhor ângulo, 3/4 frontal.
  { at: 0.94, az: 2 * TURN - 0.5, el: 0.22, dist: 0.96, focus: "center", key: 1.04, fill: 0.74, rim: 0.85, exposure: 1.03, frameX: 0.2, ease: "inOut" },
  { at: 1, az: 2 * TURN - 0.42, el: 0.21, dist: 0.92, focus: "center", key: 1.04, fill: 0.74, rim: 0.85, exposure: 1.03, frameX: 0.2, ease: "linear" },
];

const EASES = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
} as const;

/**
 * Câmera/luz para um progresso p (0..1): interpola entre tomadas com a curva de chegada de
 * cada uma. `anchor` resolve o ponto de foco no modelo; `compose` atenua o deslocamento de
 * composição (0 no celular, onde o texto fica embaixo do produto).
 */
export function rigAt(
  progress: number,
  anchor: (id: FocusId) => { x: number; y: number; z: number },
  compose: number,
): Rig {
  const p = Math.min(1, Math.max(0, progress));
  let i = SHOTS.findIndex((s) => s.at >= p);
  if (i <= 0) i = 1;
  const a = SHOTS[i - 1]!;
  const b = SHOTS[i]!;
  const span = Math.max(1e-6, b.at - a.at);
  const t = EASES[b.ease](Math.min(1, Math.max(0, (p - a.at) / span)));
  const mix = (x: number, y: number) => x + (y - x) * t;
  const fa = anchor(a.focus);
  const fb = anchor(b.focus);
  return {
    az: mix(a.az, b.az),
    el: mix(a.el, b.el),
    // Tela vertical: um pouco mais de distância para o boné (mais largo que alto) caber inteiro.
    dist: mix(a.dist, b.dist) * (compose === 0 ? 1.14 : 1),
    tx: mix(fa.x, fb.x),
    ty: mix(fa.y, fb.y),
    tz: mix(fa.z, fb.z),
    key: mix(a.key, b.key),
    fill: mix(a.fill, b.fill),
    rim: mix(a.rim, b.rim),
    exposure: mix(a.exposure, b.exposure),
    frameX: mix(a.frameX, b.frameX) * compose,
    // No celular o produto sobe no quadro para o texto ocupar a parte de baixo.
    frameY: compose === 0 ? 0.2 : 0,
  };
}

/** Ato ativo para o progresso p (o último cuja faixa começou). */
export function actAt(progress: number): number {
  let index = 0;
  ACTS.forEach((act, i) => {
    if (progress >= act.range[0] - 0.005) index = i;
  });
  return index;
}
