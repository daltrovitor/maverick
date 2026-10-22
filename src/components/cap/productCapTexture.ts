// Hello World
/**
 * Navegador: baixa a foto do produto, roda a análise (productCapLook) e recorta o logo como uma
 * imagem com fundo transparente, pronta para virar o decalque da frente do boné 3D.
 */
import { analyzeCapPixels, deltaE, rgbToLab, type Rgb } from "@/components/cap/productCapLook";

export interface CapDecal {
  readonly canvas: HTMLCanvasElement;
  /** Largura / altura do recorte. */
  readonly aspect: number;
  /** Largura do logo em relação à do boné na foto. */
  readonly widthRatio: number;
  /** Altura do centro do logo na copa (0 = aba, 1 = topo). */
  readonly rise: number;
}

export interface CapLookTextures {
  readonly crown: Rgb;
  readonly brim: Rgb;
  readonly decal: CapDecal | null;
}

/** Resolução da análise (cores, silhueta, posição do logo). */
const ANALYSIS_SIZE = 256;
/** Maior lado do recorte do logo. */
const DECAL_SIZE = 512;

/**
 * Fotos do Storage passam pelo otimizador de imagens do próprio site: mesma origem (o canvas pode
 * ler os pixels) e um arquivo já reduzido. Caminhos locais são lidos direto.
 */
export function analysisImageUrl(url: string): string {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=75`;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2D indisponível");
  return ctx;
}

/** Lê a foto e devolve as cores do boné e o logo recortado (null quando a foto não serve). */
export async function readCapLook(url: string, signal?: AbortSignal): Promise<CapLookTextures | null> {
  const res = await fetch(analysisImageUrl(url), { signal });
  if (!res.ok) throw new Error(`foto indisponível (${res.status})`);
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const scale = Math.min(1, ANALYSIS_SIZE / Math.max(bitmap.width, bitmap.height));
    const aw = Math.max(16, Math.round(bitmap.width * scale));
    const ah = Math.max(16, Math.round(bitmap.height * scale));
    const small = document.createElement("canvas");
    small.width = aw;
    small.height = ah;
    const sctx = context2d(small);
    sctx.drawImage(bitmap, 0, 0, aw, ah);
    const analysis = analyzeCapPixels(sctx.getImageData(0, 0, aw, ah).data, aw, ah);
    if (!analysis) return null;

    const logo = analysis.logo;
    if (!logo) return { crown: analysis.crown, brim: analysis.brim, decal: null };

    // Recorte em alta do logo; o tecido em volta (tom da copa) e o fundo ficam transparentes.
    const sx = logo.x * bitmap.width;
    const sy = logo.y * bitmap.height;
    const sw = logo.w * bitmap.width;
    const sh = logo.h * bitmap.height;
    const fit = Math.min(1, DECAL_SIZE / Math.max(sw, sh));
    const cw = Math.max(8, Math.round(sw * fit));
    const ch = Math.max(8, Math.round(sh * fit));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = context2d(canvas);
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, cw, ch);
    const image = ctx.getImageData(0, 0, cw, ch);
    const px = image.data;
    const crownLab = rgbToLab(...analysis.crown);
    const low = analysis.logoThreshold * 0.55;
    const high = analysis.logoThreshold * 1.1;
    for (let y = 0; y < ch; y += 1) {
      const my = Math.min(ah - 1, Math.floor((logo.y + ((y + 0.5) / ch) * logo.h) * ah));
      for (let x = 0; x < cw; x += 1) {
        const mx = Math.min(aw - 1, Math.floor((logo.x + ((x + 0.5) / cw) * logo.w) * aw));
        const i = (y * cw + x) * 4;
        const inside = analysis.mask[my * aw + mx] === 1;
        const alpha = inside ? smoothstep(low, high, deltaE(rgbToLab(px[i]!, px[i + 1]!, px[i + 2]!), crownLab)) : 0;
        if (alpha < 0.02) {
          // Cor da copa por baixo do transparente: a filtragem da GPU não cria contorno escuro.
          px[i] = analysis.crown[0];
          px[i + 1] = analysis.crown[1];
          px[i + 2] = analysis.crown[2];
        }
        px[i + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return {
      crown: analysis.crown,
      brim: analysis.brim,
      decal: { canvas, aspect: cw / ch, widthRatio: logo.widthRatio, rise: logo.rise },
    };
  } finally {
    bitmap.close();
  }
}
