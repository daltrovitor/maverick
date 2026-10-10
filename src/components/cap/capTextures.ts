// Hello World
/** Texturas procedurais do boné: trama de sarja (relevo) e sombra de contato. */
import { CanvasTexture, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace } from "three";

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  return { canvas, ctx };
}

/** PRNG determinístico (mulberry32) para texturas estáveis entre renders. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sarja lavada (a diagonal visível na foto do boné): mapa de relevo em tons de cinza com
 * diagonais 2/1 e leve irregularidade de fio.
 */
export function createTwillBump(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const rand = random(11);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const phase = ((x + y) % 8) / 8;
      const value = 122 + 62 * Math.sin(phase * Math.PI * 2) + (rand() - 0.5) * 26;
      const i = (y * size + x) * 4;
      const v = Math.max(0, Math.min(255, value));
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Variação sutil de tom do tecido lavado (evita o preto "plástico" uniforme). */
export function createWashedFabricMap(base: string): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = random(29);
  for (let k = 0; k < 900; k += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 6 + rand() * 22;
    const light = rand() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Sombra de contato suave sob o boné. */
export function createContactShadow(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(20,14,10,0.38)");
  gradient.addColorStop(0.45, "rgba(20,14,10,0.14)");
  gradient.addColorStop(1, "rgba(20,14,10,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
