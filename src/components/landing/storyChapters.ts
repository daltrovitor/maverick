// Hello World
import type { AnchorId, Pose } from "@/components/cap/CapStage";

export interface Annotation {
  readonly anchor: AnchorId;
  readonly label: string;
  /** Lado da etiqueta em relação ao ponto ancorado. */
  readonly side: "left" | "right";
}

export interface Chapter {
  readonly id: string;
  /** Palavra monumental do plano de fundo. */
  readonly word: string;
  readonly title: string;
  readonly text: string;
  readonly pose: Pose;
  readonly annotations: readonly Annotation[];
}

/**
 * Roteiro da rolagem. Os textos usam a voz da própria marca (posts do Instagram) e só
 * descrevem o que é visível na foto do produto; a traseira é sinalizada como representação.
 */
export const CHAPTERS: readonly Chapter[] = [
  {
    id: "abertura",
    word: "Maverick",
    title: "Curadoria em headwear.",
    text: "Seu próximo boné está aqui. Gire, aproxime e veja cada detalhe antes de escolher.",
    pose: { yaw: 0, pitch: 0.38, explode: 0, zoom: 1, lift: 0, shift: 0 },
    annotations: [],
  },
  {
    id: "detalhe",
    word: "Detalhe",
    title: "O detalhe que muda tudo.",
    text: "Bordado em alto-relevo sobre a frente estruturada em seis gomos.",
    pose: { yaw: -0.62, pitch: 0.16, explode: 0, zoom: 1.12, lift: 0, shift: 0.18 },
    annotations: [
      { anchor: "bordado", label: "Bordado em alto-relevo", side: "right" },
      { anchor: "costura", label: "Seis gomos com pesponto duplo", side: "left" },
    ],
  },
  {
    id: "aba",
    word: "Aba",
    title: "Muito além da aba.",
    text: "Aba curva com pespontos concêntricos e ilhoses bordados na copa.",
    pose: { yaw: 0.5, pitch: 0.52, explode: 0, zoom: 1.2, lift: 0.06, shift: -0.18 },
    annotations: [
      { anchor: "aba", label: "Aba curva · pespontos concêntricos", side: "right" },
      { anchor: "ilhos", label: "Ilhoses bordados", side: "left" },
    ],
  },
  {
    id: "construcao",
    word: "Peça a peça",
    title: "Construção à vista.",
    text: "Copa, bordado, botão e aba separados. A traseira segue a construção convencional de um dad hat; confira as fotos reais na página do produto.",
    pose: { yaw: -0.38, pitch: 0.26, explode: 1, zoom: 1, lift: 0.05, shift: 0 },
    annotations: [
      { anchor: "botao", label: "Botão forrado", side: "right" },
      { anchor: "bordado", label: "Bordado", side: "left" },
      { anchor: "aba", label: "Aba", side: "right" },
    ],
  },
  {
    id: "colecao",
    word: "Coleção",
    title: "Estilos diferentes. Algo em comum.",
    text: "Cada modelo da loja passa pela mesma curadoria.",
    pose: { yaw: Math.PI * 2, pitch: 0.2, explode: 0, zoom: 0.92, lift: 0.1, shift: 0 },
    annotations: [],
  },
];

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Pose contínua para o progresso p (0..1) da seção fixada: cada capítulo ocupa uma fatia;
 * a transição acontece na segunda metade da fatia, com o meio de cada capítulo estável.
 */
export function poseAt(progress: number): { pose: Pose; chapter: number } {
  const count = CHAPTERS.length;
  const scaled = Math.min(count - 1, Math.max(0, progress * (count - 1)));
  const index = Math.floor(scaled);
  const local = scaled - index;
  const from = CHAPTERS[index]!.pose;
  const to = CHAPTERS[Math.min(count - 1, index + 1)]!.pose;
  const t = smoothstep((local - 0.35) / 0.65);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    pose: {
      yaw: mix(from.yaw, to.yaw),
      pitch: mix(from.pitch, to.pitch),
      explode: mix(from.explode, to.explode),
      zoom: mix(from.zoom, to.zoom),
      lift: mix(from.lift, to.lift),
      shift: mix(from.shift, to.shift),
    },
    chapter: local > 0.6 ? Math.min(count - 1, index + 1) : index,
  };
}
