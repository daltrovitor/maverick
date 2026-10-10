// Hello World
/**
 * Texturas procedurais do boné (geradas no navegador, sem downloads extras):
 * normal map de sarja, variação de tom/rugosidade de tecido lavado.
 */
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

function repeatTexture(canvas: HTMLCanvasElement, srgb: boolean): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Normal map de sarja 2/1: diagonais de fios com leve irregularidade (a trama visível nas
 * fotos de lateral e traseira). Calculado a partir de um campo de altura.
 */
export function createTwillNormal(size = 256): CanvasTexture {
  const rand = random(17);
  const heightAt = new Float32Array(size * size);
  const jitter = new Float32Array(size);
  for (let i = 0; i < size; i += 1) jitter[i] = (rand() - 0.5) * 0.35;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const diag = ((x + y) % 6) / 6;
      const ridge = Math.sin(diag * Math.PI); // fio arredondado
      const yarn = 0.12 * Math.sin((x - y) * 0.9 + jitter[y]! * 6);
      heightAt[y * size + x] = ridge * 0.85 + yarn + (rand() - 0.5) * 0.12;
    }
  }
  const { canvas, ctx } = createCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const strength = 2.2;
  const h = (x: number, y: number) => heightAt[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      image.data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      image.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return repeatTexture(canvas, false);
}

/** Tom de tecido lavado: manchas suaves claras/escuras sobre a cor base (mapa de cor). */
export function createWashedFabricMap(base: string, seed = 29): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = random(seed);
  for (let k = 0; k < 1400; k += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 8 + rand() * 40;
    const light = rand() > 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return repeatTexture(canvas, true);
}

/** Rugosidade com pequenas variações (tecido fosco, sem brilho plástico). */
export function createFabricRoughness(seed = 41): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const rand = random(seed);
  for (let i = 0; i < size * size; i += 1) {
    const v = 214 + (rand() - 0.5) * 34;
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  ctx.filter = "blur(1.5px)";
  ctx.drawImage(canvas, 0, 0);
  return repeatTexture(canvas, false);
}
