// Hello World
/**
 * Texturas do estábulo da parede da coleção, desenhadas no navegador (nenhuma imagem baixada):
 * veio de madeira envelhecida (tábuas da parede e prateleiras, tingidas por peça) e o chão de
 * terra batida com palha. Tudo com semente fixa: a mesma parede em todo carregamento.
 */

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor 2D suave (0–1); com `periodY`, ele se repete no eixo y a cada `periodY` células. */
function noise(x: number, y: number, periodY = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const y0 = periodY > 0 ? ((yi % periodY) + periodY) % periodY : yi;
  const y1 = periodY > 0 ? (y0 + 1) % periodY : yi + 1;
  const a = hash(xi, y0);
  const b = hash(xi + 1, y0);
  const c = hash(xi, y1);
  const d = hash(xi + 1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("canvas 2D indisponível");
  return [element, context];
}

interface Knot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Veio de madeira em tons neutros (o tom final vem da cor de cada tábua): fibras longas no
 * sentido vertical da imagem, anéis desviando dos nós, rachaduras e o cinza de madeira exposta.
 */
export function drawWoodGrain(width: number, height: number, seed: number): HTMLCanvasElement {
  const [element, context] = canvas(width, height);
  const random = seeded(seed);
  const knots: Knot[] = Array.from({ length: Math.round((width * height) / 160_000) }, () => ({
    x: random() * width,
    y: random() * height,
    r: (0.012 + random() * 0.02) * width,
  }));
  const image = context.createImageData(width, height);
  const px = image.data;
  const sx = 1024 / width;
  // Escalas verticais arredondadas para um número inteiro de células na altura: a textura
  // se repete ao longo da tábua sem emenda.
  const cells = (scale: number) => Math.max(1, Math.round(height * scale * sx));
  const warpCells = cells(0.0012);
  const detailCells = cells(0.004);
  const streakCells = cells(0.006);
  const weatherCells = cells(0.003);
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      // Fibras: anéis verticais deformados por ruído de baixa frequência e pelos nós.
      let warp = noise(x * 0.004 * sx, v * warpCells, warpCells) * 38 + noise(x * 0.02 * sx, v * detailCells, detailCells) * 6;
      let knotDark = 0;
      for (const knot of knots) {
        const dx = x - knot.x;
        const reach = knot.r * 3.2;
        if (dx > reach || dx < -reach) continue;
        // Distância vertical "dando a volta": a textura se repete no comprimento da tábua.
        let ry = Math.abs(y - knot.y);
        ry = Math.min(ry, height - ry);
        const dy = ry * 0.45;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < reach) {
          const fall = 1 - dist / reach;
          warp += (dx / (dist + 1)) * fall * fall * knot.r * 1.6;
          if (dist < knot.r) knotDark = Math.max(knotDark, 1 - dist / knot.r);
        }
      }
      const ring = ((x * sx + warp) * 0.11) % 1;
      const fiber = Math.pow(Math.abs(Math.sin(ring * Math.PI)), 6);
      const streak = noise(x * 0.3 * sx, v * streakCells, streakCells);
      const weather = noise(x * 0.008 * sx + 40, v * weatherCells, weatherCells);
      let tone = 0.62 + 0.16 * streak - 0.22 * fiber - 0.38 * knotDark;
      // Madeira exposta ao tempo: manchas mais claras e acinzentadas.
      const silver = Math.max(0, weather - 0.55) * 1.6;
      tone += silver * 0.18;
      tone += (hash(x, y) - 0.5) * 0.07;
      const i = (y * width + x) * 4;
      px[i] = Math.max(0, Math.min(255, tone * 255 * (1 - silver * 0.05)));
      px[i + 1] = Math.max(0, Math.min(255, tone * 236));
      px[i + 2] = Math.max(0, Math.min(255, tone * 214 * (1 + silver * 0.12)));
      px[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  // Rachaduras finas ao longo do veio.
  context.lineCap = "round";
  for (let k = 0; k < Math.round(width / 40); k += 1) {
    const x0 = random() * width;
    const y0 = random() * height;
    const length = (0.04 + random() * 0.12) * height;
    context.strokeStyle = `rgba(18, 11, 6, ${0.35 + random() * 0.35})`;
    context.lineWidth = 0.6 + random() * 1.2;
    context.beginPath();
    context.moveTo(x0, y0);
    for (let t = 0; t <= 1; t += 0.1) context.lineTo(x0 + Math.sin(t * 6 + k) * 2.5, y0 + t * length);
    context.stroke();
  }
  return element;
}

/**
 * Chão do estábulo: terra batida escura com palha espalhada (fios dourados em todas as direções,
 * mais densos em montes). Ladrilhável: os fios que passam da borda reaparecem do outro lado.
 */
export function drawStrawFloor(size: number, seed: number): HTMLCanvasElement {
  const [element, context] = canvas(size, size);
  const random = seeded(seed);
  context.fillStyle = "#2a1d12";
  context.fillRect(0, 0, size, size);

  // Manchas de terra.
  for (let k = 0; k < 60; k += 1) {
    const x = random() * size;
    const y = random() * size;
    const r = (0.04 + random() * 0.12) * size;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    const shade = random() < 0.5 ? "20, 13, 7" : "62, 44, 26";
    gradient.addColorStop(0, `rgba(${shade}, 0.35)`);
    gradient.addColorStop(1, `rgba(${shade}, 0)`);
    context.fillStyle = gradient;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        context.save();
        context.translate(ox, oy);
        context.fillRect(x - r, y - r, r * 2, r * 2);
        context.restore();
      }
    }
  }

  const clumps = Array.from({ length: 9 }, () => ({ x: random() * size, y: random() * size, r: (0.12 + random() * 0.18) * size }));
  const straws = Math.round(size * 5.5);
  context.lineCap = "round";
  for (let k = 0; k < straws; k += 1) {
    let x = random() * size;
    let y = random() * size;
    // Metade dos fios se junta nos montes.
    if (random() < 0.55) {
      const clump = clumps[Math.floor(random() * clumps.length)]!;
      const angle = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * clump.r;
      x = clump.x + Math.cos(angle) * dist;
      y = clump.y + Math.sin(angle) * dist;
    }
    const angle = random() * Math.PI * 2;
    const length = (0.015 + random() * 0.05) * size;
    const bend = (random() - 0.5) * length * 0.3;
    const light = 0.55 + random() * 0.45;
    const r = Math.round(196 * light + 30);
    const g = Math.round(158 * light + 18);
    const b = Math.round(78 * light);
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.55 + random() * 0.45})`;
    context.lineWidth = (0.5 + random() * 1.4) * (size / 1024);
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const ax = x + ox;
        const ay = y + oy;
        if (ax + Math.abs(dx) < 0 || ax - Math.abs(dx) > size || ay + Math.abs(dy) < 0 || ay - Math.abs(dy) > size) continue;
        context.beginPath();
        context.moveTo(ax, ay);
        context.quadraticCurveTo(ax + dx / 2 - dy * (bend / length), ay + dy / 2 + dx * (bend / length), ax + dx, ay + dy);
        context.stroke();
      }
    }
  }
  return element;
}
