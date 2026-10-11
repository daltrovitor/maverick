// Hello World
import { describe, expect, it } from "vitest";
import { INTRO_GATE_SCRIPT, INTRO_STORAGE_KEY } from "@/components/brand/introGate";
import { LOGO_BOX, MONOGRAM_BOX } from "@/components/brand/maverickLogoGeometry";
import {
  FOUNDED,
  MONOGRAM_PATH,
  MONOGRAM_SHARDS,
  REGISTERED,
  RULES,
  TAGLINE,
  WORDMARK,
  type LogoGlyph,
} from "@/components/brand/maverickLogoPaths";

interface GateEnv {
  path?: string;
  search?: string;
  reducedMotion?: boolean;
  stored?: boolean;
  storageThrows?: boolean;
}

/** Executa o script do <head> com um navegador simulado e devolve o atributo e o armazenamento. */
function runGate({ path = "/", search = "", reducedMotion = false, stored = false, storageThrows = false }: GateEnv) {
  const attrs = new Map<string, string>();
  const storage = new Map<string, string>(stored ? [[INTRO_STORAGE_KEY, "1"]] : []);
  const sessionStorage = {
    getItem: (k: string) => {
      if (storageThrows) throw new Error("SecurityError");
      return storage.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (storageThrows) throw new Error("SecurityError");
      storage.set(k, v);
    },
  };
  const document = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
  const matchMedia = (q: string) => ({ matches: reducedMotion && q.includes("reduce") });
  new Function("location", "matchMedia", "sessionStorage", "document", INTRO_GATE_SCRIPT)(
    { pathname: path, search },
    matchMedia,
    sessionStorage,
    document,
  );
  return { intro: attrs.get("data-intro") ?? null, stored: storage.has(INTRO_STORAGE_KEY) };
}

const word = (glyphs: readonly LogoGlyph[]) => glyphs.map((g) => g.name).join("");

describe("abertura da marca — decisão no <head>", () => {
  it("toca na primeira visita à página inicial e marca a aba", () => {
    expect(runGate({})).toEqual({ intro: "playing", stored: true });
  });

  it("não repete na mesma aba", () => {
    expect(runGate({ stored: true }).intro).toBeNull();
  });

  it("?abertura força tocar de novo", () => {
    expect(runGate({ stored: true, search: "?abertura" }).intro).toBe("playing");
    expect(runGate({ stored: true, search: "?x=1&abertura" }).intro).toBe("playing");
    expect(runGate({ stored: true, search: "?aberturas" }).intro).toBeNull();
  });

  it("só existe na página inicial", () => {
    expect(runGate({ path: "/loja" }).intro).toBeNull();
    expect(runGate({ path: "/produto/bone" }).intro).toBeNull();
  });

  it("respeita movimento reduzido", () => {
    expect(runGate({ reducedMotion: true })).toEqual({ intro: null, stored: false });
  });

  it("sem acesso ao armazenamento, não toca (nunca trava a página)", () => {
    expect(runGate({ storageThrows: true }).intro).toBeNull();
  });
});

describe("logo vetorizado", () => {
  it("tem as peças do arquivo oficial, na ordem", () => {
    expect(word(WORDMARK)).toBe("MAVERICK");
    expect(word(TAGLINE)).toBe("HEADWEAR&LIFESTYLE");
    expect(word(FOUNDED)).toBe("EST.2026");
    expect(REGISTERED.name).toBe("®");
    expect(RULES).toHaveLength(2);
    expect(MONOGRAM_PATH.startsWith("M")).toBe(true);
  });

  it("todas as peças cabem no viewBox do logo", () => {
    const glyphs = [...WORDMARK, REGISTERED, ...TAGLINE, ...FOUNDED, ...RULES];
    for (const g of glyphs) {
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.y).toBeGreaterThanOrEqual(0);
      expect(g.x + g.w).toBeLessThanOrEqual(LOGO_BOX.w);
      expect(g.y + g.h).toBeLessThanOrEqual(LOGO_BOX.h);
    }
    expect(MONOGRAM_BOX.x + MONOGRAM_BOX.w).toBeLessThanOrEqual(LOGO_BOX.w);
    expect(MONOGRAM_BOX.y + MONOGRAM_BOX.h).toBeLessThanOrEqual(LOGO_BOX.h);
  });

  it("o nome fica abaixo do monograma e os fios ladeiam o ano", () => {
    const monoBottom = MONOGRAM_BOX.y + MONOGRAM_BOX.h;
    expect(Math.min(...WORDMARK.map((g) => g.y))).toBeGreaterThan(monoBottom);
    const [left, right] = RULES;
    const yearLeft = Math.min(...FOUNDED.map((g) => g.x));
    const yearRight = Math.max(...FOUNDED.map((g) => g.x + g.w));
    expect(left.x + left.w).toBeLessThan(yearLeft);
    expect(right.x).toBeGreaterThan(yearRight);
  });
});

describe("estilhaços do monograma", () => {
  const triangles = MONOGRAM_SHARDS.map((s) => s.points.split(" ").map((p) => p.split(",").map(Number) as [number, number]));
  const area = (t: [number, number][]) => {
    const [a, b, c] = t as [[number, number], [number, number], [number, number]];
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  };

  it("são triângulos dentro da caixa do monograma (com a sobreposição)", () => {
    for (const t of triangles) {
      expect(t).toHaveLength(3);
      for (const [x, y] of t) {
        expect(x).toBeGreaterThanOrEqual(-2);
        expect(y).toBeGreaterThanOrEqual(-2);
        expect(x).toBeLessThanOrEqual(MONOGRAM_BOX.w + 2);
        expect(y).toBeLessThanOrEqual(MONOGRAM_BOX.h + 2);
      }
    }
  });

  it("cobrem o monograma inteiro (sem buracos quando se encaixam)", () => {
    const covered = triangles.reduce((sum, t) => sum + area(t), 0);
    expect(covered).toBeGreaterThanOrEqual(MONOGRAM_BOX.w * MONOGRAM_BOX.h * 0.97);
  });

  it("entram em sequência, com dourado só como acento", () => {
    const delays = MONOGRAM_SHARDS.map((s) => s.delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(Math.max(...delays)).toBeLessThan(700);
    expect(MONOGRAM_SHARDS.filter((s) => s.tone === "#b88a2e")).toHaveLength(2);
  });
});
