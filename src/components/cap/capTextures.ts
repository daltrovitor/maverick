// Hello World
/** Texturas procedurais (Canvas 2D) do boné: tramas de tecido, bordado, selo e sombra de contato. */
import { CanvasTexture, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace } from "three";
import {
  HORSE_DETAIL_PATHS,
  HORSE_EYE,
  HORSE_HALO_WIDTH,
  HORSE_HEAD_PATHS,
  HORSE_NECK_PATH,
  HORSE_TRANSFORM,
  MAVERICK_M_PATHS,
  MAVERICK_VIEWBOX_RECT,
} from "@/components/brand/marks";
import type { FabricKind } from "@/components/cap/editions";

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

/* ───────────── Trama do tecido (bump map em tons de cinza) ───────────── */

export function createFabricBump(kind: FabricKind): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const rand = random(kind === "sarja" ? 11 : kind === "camurca" ? 23 : 37);
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 128;
      if (kind === "sarja") {
        // Diagonais de sarja 2/1
        const phase = ((x + y) % 8) / 8;
        value = 120 + 70 * Math.sin(phase * Math.PI * 2) + (rand() - 0.5) * 18;
      } else if (kind === "cotele") {
        // Nervuras do veludo cotelê
        const rib = Math.sin((x / size) * Math.PI * 2 * 16);
        value = 128 + 95 * Math.sign(rib) * Math.pow(Math.abs(rib), 0.5) + (rand() - 0.5) * 22;
      } else {
        // Camurça: felpa irregular
        value = 128 + (rand() - 0.5) * 90;
      }
      const index = (y * size + x) * 4;
      const clamped = Math.max(0, Math.min(255, value));
      image.data[index] = clamped;
      image.data[index + 1] = clamped;
      image.data[index + 2] = clamped;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (kind === "camurca") {
    ctx.filter = "blur(1px)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* ───────────── Monograma em Canvas 2D ───────────── */

interface MonogramPaths {
  readonly m: readonly Path2D[];
  readonly head: readonly Path2D[];
  readonly neck: Path2D;
  readonly details: readonly Path2D[];
}

let monogramPaths: MonogramPaths | null = null;

/** Path2D só existe no navegador: cria sob demanda e memoriza. */
function getMonogramPaths(): MonogramPaths {
  monogramPaths ??= {
    m: MAVERICK_M_PATHS.map((d) => new Path2D(d)),
    head: HORSE_HEAD_PATHS.map((d) => new Path2D(d)),
    neck: new Path2D(HORSE_NECK_PATH),
    details: HORSE_DETAIL_PATHS.map((d) => new Path2D(d)),
  };
  return monogramPaths;
}

/** Desenha o monograma em coordenadas do viewBox (o chamador posiciona/escala o contexto). */
function drawMonogram(ctx: CanvasRenderingContext2D, color: string): void {
  const { m: M_PATHS, head: HEAD_PATHS, neck: NECK_PATH, details: DETAIL_PATHS } = getMonogramPaths();
  ctx.fillStyle = color;
  for (const path of M_PATHS) ctx.fill(path);

  // Recorte do cavalo (halo transparente que separa o cavalo das hastes).
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineJoin = "round";
  ctx.lineWidth = HORSE_HALO_WIDTH;
  ctx.save();
  ctx.translate(HORSE_TRANSFORM.x, HORSE_TRANSFORM.y);
  ctx.scale(HORSE_TRANSFORM.scale, HORSE_TRANSFORM.scale);
  for (const path of HEAD_PATHS) {
    ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.restore();
  ctx.fill(NECK_PATH);
  ctx.stroke(NECK_PATH);
  ctx.restore();

  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(HORSE_TRANSFORM.x, HORSE_TRANSFORM.y);
  ctx.scale(HORSE_TRANSFORM.scale, HORSE_TRANSFORM.scale);
  for (const path of HEAD_PATHS) ctx.fill(path);
  ctx.restore();
  ctx.fill(NECK_PATH);

  // Detalhes vazados (ganacha, narina e olho).
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.save();
  ctx.translate(HORSE_TRANSFORM.x, HORSE_TRANSFORM.y);
  ctx.scale(HORSE_TRANSFORM.scale, HORSE_TRANSFORM.scale);
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  for (const path of DETAIL_PATHS) ctx.stroke(path);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(HORSE_EYE.cx, HORSE_EYE.cy, HORSE_EYE.rx, HORSE_EYE.ry, (HORSE_EYE.rotate * Math.PI) / 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const EMBROIDERY_ASPECT = 1.42;

/**
 * Bordado frontal: cor + mapa de relevo (puff) com pontos cetim diagonais.
 * Retorna duas texturas que compartilham o mesmo layout.
 */
export function createEmbroideryTextures(threadColor: string): { map: CanvasTexture; bump: CanvasTexture } {
  const height = 640;
  const width = Math.round(height * EMBROIDERY_ASPECT);
  const scale = (height * 0.86) / MAVERICK_VIEWBOX_RECT.height;
  const offsetX = (width - MAVERICK_VIEWBOX_RECT.width * scale) / 2 - MAVERICK_VIEWBOX_RECT.x * scale;
  const offsetY = (height - MAVERICK_VIEWBOX_RECT.height * scale) / 2 - MAVERICK_VIEWBOX_RECT.y * scale;

  const place = (ctx: CanvasRenderingContext2D) => {
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
  };

  // Cor do fio com textura de ponto cetim.
  const color = createCanvas(width, height);
  color.ctx.save();
  place(color.ctx);
  drawMonogram(color.ctx, threadColor);
  color.ctx.restore();
  color.ctx.save();
  color.ctx.globalCompositeOperation = "source-atop";
  color.ctx.lineWidth = 2;
  for (let x = -height; x < width; x += 6) {
    color.ctx.strokeStyle = "rgba(255,255,255,0.10)";
    color.ctx.beginPath();
    color.ctx.moveTo(x, height);
    color.ctx.lineTo(x + height * 0.7, 0);
    color.ctx.stroke();
    color.ctx.strokeStyle = "rgba(0,0,0,0.12)";
    color.ctx.beginPath();
    color.ctx.moveTo(x + 3, height);
    color.ctx.lineTo(x + 3 + height * 0.7, 0);
    color.ctx.stroke();
  }
  color.ctx.restore();

  // Relevo: silhueta desfocada (volume do puff) + estrias do ponto.
  const bump = createCanvas(width, height);
  bump.ctx.fillStyle = "#000";
  bump.ctx.fillRect(0, 0, width, height);
  bump.ctx.save();
  bump.ctx.filter = "blur(7px)";
  place(bump.ctx);
  drawMonogram(bump.ctx, "#ffffff");
  bump.ctx.restore();
  bump.ctx.save();
  bump.ctx.globalCompositeOperation = "source-over";
  bump.ctx.filter = "none";
  bump.ctx.globalAlpha = 0.18;
  bump.ctx.strokeStyle = "#000";
  bump.ctx.lineWidth = 2;
  for (let x = -height; x < width; x += 6) {
    bump.ctx.beginPath();
    bump.ctx.moveTo(x, height);
    bump.ctx.lineTo(x + height * 0.7, 0);
    bump.ctx.stroke();
  }
  bump.ctx.restore();

  const map = new CanvasTexture(color.canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  const bumpTexture = new CanvasTexture(bump.canvas);
  bumpTexture.colorSpace = LinearSRGBColorSpace;
  return { map, bump: bumpTexture };
}

/** Etiqueta tecida com numeração da edição de lançamento. */
export function createLabelTexture(background: string, ink: string, serifFamily: string): CanvasTexture {
  const width = 512;
  const height = 280;
  const { canvas, ctx } = createCanvas(width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 70px ${serifFamily}`;
  ctx.fillText("MAVERICK", width / 2, height * 0.4);
  ctx.font = `400 38px ${serifFamily}`;
  ctx.fillText("Nº 027 / 100", width / 2, height * 0.72);

  // Trama de tecelagem
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#000";
  for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Sombra de contato suave sob o boné (claro-escuro). */
export function createContactShadow(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(31,22,18,0.42)");
  gradient.addColorStop(0.45, "rgba(31,22,18,0.16)");
  gradient.addColorStop(1, "rgba(31,22,18,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
