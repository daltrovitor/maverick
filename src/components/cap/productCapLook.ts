// Hello World
/**
 * Lê a foto de um produto e descobre como pintar o boné 3D neutro (public/models/cap-blank):
 * cor da copa, cor da aba e onde está o logo da frente. Funciona só com pixels (RGBA), sem DOM,
 * para rodar igual no navegador e nos testes.
 *
 * 1. Fundo: cor mediana da borda da foto, removida por preenchimento a partir das bordas (fundos
 *    lisos de estúdio, branco/creme/cinza) ou pelo canal alfa quando a foto é recortada (PNG).
 * 2. Silhueta: caixa dos pixels que sobram (o boné).
 * 3. Cores: o tom predominante (Lab) no alto da silhueta é a copa; no pé dela, a aba.
 * 4. Logo: o maior bloco de pixels que destoam da copa, perto do centro da frente.
 */

/** Cor sRGB 0–255. */
export type Rgb = readonly [number, number, number];

export interface LogoRegion {
  /** Caixa do logo na foto, em frações da imagem (0–1). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Largura do logo em relação à largura do boné na foto. */
  readonly widthRatio: number;
  /** Altura do centro do logo na copa: 0 = encontro com a aba, 1 = topo. */
  readonly rise: number;
}

export interface CapLook {
  readonly crown: Rgb;
  readonly brim: Rgb;
  readonly logo: LogoRegion | null;
  /** Diferença (ΔE) a partir da qual um pixel "não é tecido" — usada no recorte do logo. */
  readonly logoThreshold: number;
}

export interface CapAnalysis extends CapLook {
  /** Máscara do boné (1 = boné) na resolução analisada, para recortar o logo sem o fundo. */
  readonly mask: Uint8Array;
  readonly width: number;
  readonly height: number;
}

type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

const LINEAR = new Float32Array(256).map((_, i) => srgbToLinear(i));

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = LINEAR[r]!;
  const lg = LINEAR[g]!;
  const lb = LINEAR[b]!;
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: Lab | readonly number[], b: Lab | readonly number[]): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((x, y) => x - y);
  return sorted[sorted.length >> 1]!;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Tom predominante dos pixels dados: moda num histograma Lab grosso, refinada pela média dos vizinhos. */
function dominant(
  indices: number[],
  data: Uint8ClampedArray,
  lab: Float32Array,
): { rgb: Rgb; lab: Lab; share: number; spread: number } | null {
  if (indices.length === 0) return null;
  const bins = new Map<number, number>();
  for (const i of indices) {
    const L = Math.min(12, Math.max(0, Math.floor(lab[i * 3]! / 8)));
    const A = Math.min(25, Math.max(0, Math.floor((lab[i * 3 + 1]! + 128) / 10)));
    const B = Math.min(25, Math.max(0, Math.floor((lab[i * 3 + 2]! + 128) / 10)));
    const key = (L * 26 + A) * 26 + B;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  let best = -1;
  let bestCount = -1;
  for (const [key, count] of bins) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  const B = best % 26;
  const A = Math.floor(best / 26) % 26;
  const L = Math.floor(best / 676);
  let center: Lab = [L * 8 + 4, A * 10 - 128 + 5, B * 10 - 128 + 5];
  // Duas passadas de média dos pixels próximos da moda (o tom "de verdade" do tecido).
  let members: number[] = [];
  for (let pass = 0; pass < 2; pass += 1) {
    members = indices.filter((i) => deltaE([lab[i * 3]!, lab[i * 3 + 1]!, lab[i * 3 + 2]!], center) < 16);
    if (members.length === 0) break;
    let sl = 0;
    let sa = 0;
    let sb = 0;
    for (const i of members) {
      sl += lab[i * 3]!;
      sa += lab[i * 3 + 1]!;
      sb += lab[i * 3 + 2]!;
    }
    center = [sl / members.length, sa / members.length, sb / members.length];
  }
  if (members.length === 0) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of members) {
    r += LINEAR[data[i * 4]!]!;
    g += LINEAR[data[i * 4 + 1]!]!;
    b += LINEAR[data[i * 4 + 2]!]!;
  }
  const toSrgb = (v: number) => {
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
  };
  const n = members.length;
  const spread = median(indices.map((i) => deltaE([lab[i * 3]!, lab[i * 3 + 1]!, lab[i * 3 + 2]!], center)));
  return { rgb: [toSrgb(r / n), toSrgb(g / n), toSrgb(b / n)], lab: center, share: n / indices.length, spread };
}

/** Pixels de primeiro plano (o boné): 1 = boné, 0 = fundo. */
function foregroundMask(data: Uint8ClampedArray, lab: Float32Array, width: number, height: number): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total).fill(1);
  const border: number[] = [];
  for (let x = 0; x < width; x += 1) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) border.push(y * width, y * width + width - 1);

  const transparent = border.filter((i) => data[i * 4 + 3]! < 128).length;
  if (transparent > border.length * 0.5) {
    // Foto recortada (PNG com transparência): o alfa já separa o boné.
    for (let i = 0; i < total; i += 1) mask[i] = data[i * 4 + 3]! >= 128 ? 1 : 0;
    return mask;
  }

  const bg: Lab = [
    median(border.map((i) => lab[i * 3]!)),
    median(border.map((i) => lab[i * 3 + 1]!)),
    median(border.map((i) => lab[i * 3 + 2]!)),
  ];
  const spread = median(border.map((i) => deltaE([lab[i * 3]!, lab[i * 3 + 1]!, lab[i * 3 + 2]!], bg)));
  const tolerance = Math.max(10, Math.min(30, spread * 3 + 6));
  const close = (i: number) =>
    data[i * 4 + 3]! < 128 || deltaE([lab[i * 3]!, lab[i * 3 + 1]!, lab[i * 3 + 2]!], bg) < tolerance;

  // Preenchimento a partir das bordas: só o fundo ligado à borda sai (um boné branco no fundo
  // branco mantém o miolo, que fica cercado pelo contorno e pelas sombras do próprio boné).
  const stack: number[] = [];
  for (const i of border) {
    if (mask[i] === 1 && close(i)) {
      mask[i] = 0;
      stack.push(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i - x) / width;
    const visit = (j: number) => {
      if (mask[j] === 1 && close(j)) {
        mask[j] = 0;
        stack.push(j);
      }
    };
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (y > 0) visit(i - width);
    if (y < height - 1) visit(i + width);
  }
  return mask;
}

/** Caixa do boné: linhas/colunas com presença real (ignora sujeira e sombras finas). */
function silhouette(mask: Uint8Array, width: number, height: number): Box | null {
  const rows = new Array<number>(height).fill(0);
  const cols = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        rows[y]! += 1;
        cols[x]! += 1;
      }
    }
  }
  const minRow = Math.max(2, width * 0.03);
  const minCol = Math.max(2, height * 0.03);
  const top = rows.findIndex((n) => n >= minRow);
  const bottom = height - 1 - rows.slice().reverse().findIndex((n) => n >= minRow);
  const left = cols.findIndex((n) => n >= minCol);
  const right = width - 1 - cols.slice().reverse().findIndex((n) => n >= minCol);
  if (top < 0 || left < 0 || bottom <= top || right <= left) return null;
  if ((right - left) * (bottom - top) < width * height * 0.05) return null;
  return { left, top, right, bottom };
}

function pixelsIn(mask: Uint8Array, width: number, box: Box): number[] {
  const out: number[] = [];
  for (let y = Math.max(0, Math.round(box.top)); y <= Math.round(box.bottom); y += 1) {
    for (let x = Math.max(0, Math.round(box.left)); x <= Math.round(box.right); x += 1) {
      const i = y * width + x;
      if (mask[i]) out.push(i);
    }
  }
  return out;
}

/** Logo da frente: o maior bloco de pixels que destoam da copa, perto do centro da frente. */
function findLogo(
  mask: Uint8Array,
  lab: Float32Array,
  width: number,
  height: number,
  cap: Box,
  crown: Lab,
  threshold: number,
): LogoRegion | null {
  const W = cap.right - cap.left;
  const H = cap.bottom - cap.top;
  const win: Box = {
    left: Math.round(cap.left + W * 0.14),
    right: Math.round(cap.right - W * 0.14),
    top: Math.round(cap.top + H * 0.08),
    bottom: Math.round(cap.top + H * 0.72),
  };
  const cell = Math.max(2, Math.round(Math.min(W, H) / 48));
  const gw = Math.ceil((win.right - win.left + 1) / cell);
  const gh = Math.ceil((win.bottom - win.top + 1) / cell);
  if (gw < 4 || gh < 4) return null;
  const counts = new Float32Array(gw * gh);
  const totals = new Float32Array(gw * gh);
  for (let y = win.top; y <= win.bottom; y += 1) {
    for (let x = win.left; x <= win.right; x += 1) {
      const i = y * width + x;
      const c = Math.floor((y - win.top) / cell) * gw + Math.floor((x - win.left) / cell);
      totals[c]! += 1;
      if (mask[i] && deltaE([lab[i * 3]!, lab[i * 3 + 1]!, lab[i * 3 + 2]!], crown) > threshold) counts[c]! += 1;
    }
  }
  const marked = new Uint8Array(gw * gh);
  for (let c = 0; c < marked.length; c += 1) marked[c] = totals[c]! > 0 && counts[c]! / totals[c]! >= 0.3 ? 1 : 0;
  // Dilata 1 célula: letras e partes de um mesmo logo viram um bloco só.
  const grown = new Uint8Array(gw * gh);
  for (let cy = 0; cy < gh; cy += 1) {
    for (let cx = 0; cx < gw; cx += 1) {
      if (!marked[cy * gw + cx]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) grown[ny * gw + nx] = 1;
        }
      }
    }
  }

  const label = new Int32Array(gw * gh).fill(-1);
  let best: { cells: number[]; score: number } | null = null;
  for (let start = 0; start < grown.length; start += 1) {
    if (!grown[start] || label[start] !== -1) continue;
    const cells: number[] = [];
    const queue = [start];
    label[start] = start;
    while (queue.length > 0) {
      const c = queue.pop()!;
      cells.push(c);
      const cx = c % gw;
      const cy = (c - cx) / gw;
      for (const [nx, ny] of [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ] as const) {
        const n = ny * gw + nx;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && grown[n] && label[n] === -1) {
          label[n] = start;
          queue.push(n);
        }
      }
    }
    let mass = 0;
    let sx = 0;
    let sy = 0;
    for (const c of cells) {
      const m = counts[c]!;
      mass += m;
      sx += (c % gw) * m;
      sy += Math.floor(c / gw) * m;
    }
    if (mass <= 0) continue;
    const dx = (sx / mass / gw - 0.5) / 0.35;
    const dy = (sy / mass / gh - 0.5) / 0.45;
    const score = mass * Math.exp(-(dx * dx + dy * dy));
    if (!best || score > best.score) best = { cells, score };
  }
  if (!best) return null;

  // Caixa dos pixels destoantes dentro do bloco escolhido.
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let mass = 0;
  for (const c of best.cells) {
    if (counts[c]! <= 0) continue;
    const cx = c % gw;
    const cy = (c - cx) / gw;
    const x0 = win.left + cx * cell;
    const y0 = win.top + cy * cell;
    for (let y = y0; y < Math.min(y0 + cell, win.bottom + 1); y += 1) {
      for (let x = x0; x < Math.min(x0 + cell, win.right + 1); x += 1) {
        const i = y * width + x;
        if (mask[i] && deltaE([lab[i * 3]!, lab[i * 3 + 1]!, lab[i * 3 + 2]!], crown) > threshold) {
          mass += 1;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
  }
  const lw = right - left + 1;
  const lh = bottom - top + 1;
  const winArea = (win.right - win.left + 1) * (win.bottom - win.top + 1);
  if (!Number.isFinite(lw) || mass < Math.max(24, winArea * 0.004)) return null;
  if (lw < W * 0.06 || lh < H * 0.04 || lw > W * 0.82) return null;

  const pad = Math.max(2, Math.round(Math.max(lw, lh) * 0.06));
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const x1 = Math.min(width - 1, right + pad);
  const y1 = Math.min(height - 1, bottom + pad);
  const centerY = (top + bottom) / 2;
  // De frente a copa ocupa ~72% da altura do boné na foto (o resto é a aba).
  const rise = 1 - (centerY - cap.top) / (H * 0.72);
  return {
    x: x0 / width,
    y: y0 / height,
    w: (x1 - x0 + 1) / width,
    h: (y1 - y0 + 1) / height,
    widthRatio: lw / W,
    rise: Math.min(0.85, Math.max(0.2, rise)),
  };
}

/** Analisa a foto (RGBA). Devolve null quando não dá para achar um boné nela. */
export function analyzeCapPixels(data: Uint8ClampedArray, width: number, height: number): CapAnalysis | null {
  if (width < 16 || height < 16 || data.length < width * height * 4) return null;
  const total = width * height;
  const lab = new Float32Array(total * 3);
  for (let i = 0; i < total; i += 1) {
    const [L, A, B] = rgbToLab(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
    lab[i * 3] = L;
    lab[i * 3 + 1] = A;
    lab[i * 3 + 2] = B;
  }
  const mask = foregroundMask(data, lab, width, height);
  const cap = silhouette(mask, width, height);
  if (!cap) return null;
  const W = cap.right - cap.left;
  const H = cap.bottom - cap.top;

  const crown = dominant(
    pixelsIn(mask, width, { left: cap.left + W * 0.06, right: cap.right - W * 0.06, top: cap.top + H * 0.08, bottom: cap.top + H * 0.62 }),
    data,
    lab,
  );
  if (!crown) return null;

  // Aba: só muda de cor quando o pé da silhueta tem, com folga, outro tom predominante.
  const brimSample = dominant(
    pixelsIn(mask, width, { left: cap.left + W * 0.2, right: cap.right - W * 0.2, top: cap.top + H * 0.8, bottom: cap.top + H * 0.97 }),
    data,
    lab,
  );
  const brim = brimSample && brimSample.share > 0.45 && deltaE(brimSample.lab, crown.lab) > 30 ? brimSample.rgb : crown.rgb;

  const threshold = Math.max(24, Math.min(40, crown.spread * 2.5 + 12));
  const logo = findLogo(mask, lab, width, height, cap, crown.lab, threshold);
  return { crown: crown.rgb, brim, logo, logoThreshold: threshold, mask, width, height };
}
