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
  /** Pose do boné nesta tomada (rad; `lift` em unidades do modelo). Omitido = repouso. */
  readonly tilt?: number;
  readonly roll?: number;
  readonly spin?: number;
  readonly lift?: number;
  /** Curva de chegada a esta tomada. */
  readonly ease: Ease;
  /** Curva própria do giro (ex.: um 360° contínuo dividido em duas tomadas pelo salto). */
  readonly spinEase?: Ease;
}

type Ease = "inOut" | "out" | "in" | "linear";

export interface Annotation {
  readonly anchor: AnchorId;
  readonly label: string;
  readonly side: "left" | "right";
}

export interface Act {
  readonly id: string;
  /** Faixa da rolagem (0..1) em que o texto do ato fica visível. */
  readonly range: readonly [number, number];
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
    nav: "Abertura",
    title: "Curadoria em headwear.",
    text: "Um boné de seis gomos, apresentado peça por peça. Role devagar.",
    annotations: [],
  },
  {
    id: "revelacao",
    range: [0.12, 0.235],
    nav: "O boné",
    title: "Preto, fosco, sem excessos.",
    text: "A copa arredondada aparece por inteiro, sob luz de estúdio.",
    annotations: [],
  },
  {
    id: "frente",
    range: [0.245, 0.355],
    nav: "Frente",
    title: "O bordado na frente.",
    text: "O jogador de polo bordado em branco, sobre a costura central.",
    annotations: [{ anchor: "pony", label: "Bordado frontal", side: "right" }],
  },
  {
    id: "materia",
    range: [0.365, 0.475],
    nav: "Aba",
    title: "Aba curva, pespontos paralelos.",
    text: "Fileiras de pesponto acompanham a borda da aba pré-curvada.",
    annotations: [{ anchor: "brim", label: "Pespontos da aba", side: "right" }],
  },
  {
    id: "lateral",
    range: [0.485, 0.615],
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
    nav: "Traseira",
    title: "Por trás, os acabamentos.",
    text: "Abertura com tira de ajuste e o bordado POLO no gomo de trás.",
    annotations: [
      { anchor: "polo", label: "Bordado POLO", side: "left" },
      { anchor: "strap", label: "Tira de ajuste", side: "right" },
    ],
  },
  {
    id: "360",
    range: [0.775, 0.885],
    nav: "360°",
    title: "Por inteiro.",
    text: "Uma volta completa. Arraste para girar quando quiser; a rolagem retoma o percurso.",
    annotations: [],
  },
  {
    id: "colecao",
    range: [0.895, 1.01],
    nav: "Coleção",
    title: "Seu próximo boné.",
    text: "Estilos diferentes. Algo em comum. Veja os modelos disponíveis na loja.",
    annotations: [],
  },
];

const TURN = Math.PI * 2;

/*
 * Tomadas de câmera + pose do boné. O boné tem área própria na tela (nunca passa por baixo do
 * texto), então os planos abertos deixam folga e os detalhes aproximam sem estourar o quadro.
 */
export const SHOTS: readonly Shot[] = [
  // Ato 1 — atmosfera: silhueta com luz de recorte; o boné ainda flutua, inclinado.
  { at: 0, az: -0.75, el: 0.26, dist: 1.18, focus: "center", key: 0.22, fill: 0.12, rim: 1.35, exposure: 0.82, tilt: 0.1, roll: -0.12, spin: -0.35, lift: 0.12, ease: "linear" },
  { at: 0.09, az: -0.55, el: 0.24, dist: 1.1, focus: "center", key: 0.55, fill: 0.3, rim: 1.15, exposure: 0.9, tilt: 0.05, roll: -0.06, spin: -0.15, lift: 0.06, ease: "inOut" },
  // Ato 2 — revelação: a luz sobe e o boné assenta de frente.
  { at: 0.15, az: -0.3, el: 0.22, dist: 1.04, focus: "center", key: 1, fill: 0.62, rim: 0.95, exposure: 1, ease: "inOut" },
  { at: 0.225, az: 0, el: 0.2, dist: 1, focus: "center", key: 1.02, fill: 0.72, rim: 0.82, exposure: 1.02, ease: "inOut" },
  // Ato 3 — frente: aproxima do bordado; o boné se inclina de leve para a câmera.
  { at: 0.28, az: 0.06, el: 0.13, dist: 0.74, focus: "pony", key: 1.08, fill: 0.78, rim: 0.7, exposure: 1.03, tilt: -0.05, ease: "inOut" },
  { at: 0.345, az: 0.24, el: 0.1, dist: 0.7, focus: "pony", key: 1.1, fill: 0.8, rim: 0.7, exposure: 1.03, tilt: -0.04, roll: 0.03, ease: "linear" },
  // Ato 4 — matéria: o boné tomba para a frente e mostra a aba e os pespontos.
  { at: 0.41, az: 0.42, el: 0.5, dist: 0.96, focus: "center", key: 1.12, fill: 0.7, rim: 0.6, exposure: 1.04, tilt: 0.28, roll: 0.04, ease: "inOut" },
  { at: 0.465, az: 0.7, el: 0.42, dist: 0.94, focus: "center", key: 1.12, fill: 0.7, rim: 0.65, exposure: 1.04, tilt: 0.22, roll: 0.06, ease: "linear" },
  // Ato 5 — lateral: recua e percorre o perfil (gomos, ilhoses, costuras).
  { at: 0.52, az: 1.25, el: 0.2, dist: 1, focus: "center", key: 1, fill: 0.72, rim: 0.85, exposure: 1.02, ease: "inOut" },
  { at: 0.575, az: 1.6, el: 0.24, dist: 0.94, focus: "center", key: 1.02, fill: 0.72, rim: 0.9, exposure: 1.02, roll: -0.06, ease: "inOut" },
  { at: 0.615, az: 2.05, el: 0.22, dist: 0.96, focus: "center", key: 1, fill: 0.7, rim: 0.95, exposure: 1.02, ease: "inOut" },
  // Ato 6 — traseira: o bordado POLO, depois a tira de ajuste.
  { at: 0.665, az: 2.85, el: 0.28, dist: 0.84, focus: "polo", key: 1.02, fill: 0.7, rim: 1, exposure: 1.02, ease: "inOut" },
  { at: 0.71, az: 3.1, el: 0.22, dist: 0.72, focus: "polo", key: 1.05, fill: 0.72, rim: 1.05, exposure: 1.03, ease: "linear" },
  { at: 0.755, az: 3.4, el: 0.16, dist: 1, focus: "strap", key: 1.12, fill: 0.7, rim: 1.3, exposure: 1.04, tilt: -0.1, ease: "inOut" },
  // Ato 7 — 360°: a câmera recua e o próprio boné dá uma volta completa, com um pequeno salto.
  { at: 0.79, az: 3.75, el: 0.24, dist: 1.06, focus: "center", key: 1, fill: 0.72, rim: 0.9, exposure: 1.02, lift: 0.04, ease: "inOut" },
  // O salto sobe e desce (inOut); o giro acelera e desacelera numa volta só (in → out).
  { at: 0.835, az: 4.05, el: 0.22, dist: 1.08, focus: "center", key: 1, fill: 0.72, rim: 0.9, exposure: 1.02, spin: -Math.PI, lift: 0.3, tilt: -0.12, roll: 0.1, ease: "inOut", spinEase: "in" },
  { at: 0.88, az: 4.35, el: 0.24, dist: 1.06, focus: "center", key: 1, fill: 0.72, rim: 0.9, exposure: 1.02, spin: -TURN, lift: 0.03, ease: "inOut", spinEase: "out" },
  // Ato 8 — encerramento: o melhor ângulo, 3/4 frontal, com uma leve reverência.
  { at: 0.94, az: TURN - 0.5, el: 0.22, dist: 0.98, focus: "center", key: 1.04, fill: 0.74, rim: 0.85, exposure: 1.03, spin: -TURN, tilt: 0.05, ease: "inOut" },
  { at: 1, az: TURN - 0.42, el: 0.21, dist: 0.96, focus: "center", key: 1.04, fill: 0.74, rim: 0.85, exposure: 1.03, spin: -TURN, tilt: 0.03, ease: "linear" },
];

const EASES = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
} as const;

/**
 * Câmera/luz/pose para um progresso p (0..1): interpola entre tomadas com a curva de chegada
 * de cada uma. `anchor` resolve o ponto de foco no modelo.
 */
export function rigAt(progress: number, anchor: (id: FocusId) => { x: number; y: number; z: number }): Rig {
  const p = Math.min(1, Math.max(0, progress));
  let i = SHOTS.findIndex((s) => s.at >= p);
  if (i <= 0) i = 1;
  const a = SHOTS[i - 1]!;
  const b = SHOTS[i]!;
  const span = Math.max(1e-6, b.at - a.at);
  const raw = Math.min(1, Math.max(0, (p - a.at) / span));
  const t = EASES[b.ease](raw);
  const ts = EASES[b.spinEase ?? b.ease](raw);
  const mix = (x: number, y: number) => x + (y - x) * t;
  const fa = anchor(a.focus);
  const fb = anchor(b.focus);
  return {
    az: mix(a.az, b.az),
    el: mix(a.el, b.el),
    dist: mix(a.dist, b.dist),
    tx: mix(fa.x, fb.x),
    ty: mix(fa.y, fb.y),
    tz: mix(fa.z, fb.z),
    key: mix(a.key, b.key),
    fill: mix(a.fill, b.fill),
    rim: mix(a.rim, b.rim),
    exposure: mix(a.exposure, b.exposure),
    frameX: 0,
    frameY: 0,
    tilt: mix(a.tilt ?? 0, b.tilt ?? 0),
    roll: mix(a.roll ?? 0, b.roll ?? 0),
    spin: (a.spin ?? 0) + ((b.spin ?? 0) - (a.spin ?? 0)) * ts,
    lift: mix(a.lift ?? 0, b.lift ?? 0),
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
