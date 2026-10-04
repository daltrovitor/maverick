// Hello World
/** Edições do boné Maverick: paletas compartilhadas pelo modelo 3D e pelas ilustrações SVG. */

export type EditionId = "black" | "sand" | "hunter";
export type FabricKind = "sarja" | "camurca" | "cotele";

export interface CapEdition {
  readonly id: EditionId;
  readonly name: string;
  readonly fabricLabel: string;
  readonly fabric: FabricKind;
  readonly description: string;
  readonly colors: {
    readonly crown: string;
    readonly underbrim: string;
    readonly stitch: string;
    readonly embroidery: string;
    readonly leather: string;
    readonly metal: string;
    readonly lining: string;
    readonly sweatband: string;
    readonly labelBg: string;
    readonly labelInk: string;
  };
}

export const CAP_EDITIONS: Readonly<Record<EditionId, CapEdition>> = {
  black: {
    id: "black",
    name: "Maverick Black Edition",
    fabricLabel: "Sarja encorpada",
    fabric: "sarja",
    description: "Sarja preta encorpada, bordado em fio champanhe e fecho em couro espresso.",
    colors: {
      crown: "#121110",
      underbrim: "#2b1d16",
      stitch: "#4a433d",
      embroidery: "#d4af37",
      leather: "#2b1d16",
      metal: "#c9a24a",
      lining: "#2a2420",
      sweatband: "#1f1a17",
      labelBg: "#1f1612",
      labelInk: "#d4af37",
    },
  },
  sand: {
    id: "sand",
    name: "Sand & Leather",
    fabricLabel: "Camurça",
    fabric: "camurca",
    description: "Camurça cor de areia, bordado espresso e tira em couro caramelo.",
    colors: {
      crown: "#c9b495",
      underbrim: "#6b4f36",
      stitch: "#a38c6c",
      embroidery: "#2b1d16",
      leather: "#8a5a32",
      metal: "#b08d57",
      lining: "#faf6f0",
      sweatband: "#efe6d6",
      labelBg: "#2b1d16",
      labelInk: "#faf6f0",
    },
  },
  hunter: {
    id: "hunter",
    name: "Hunter Green",
    fabricLabel: "Veludo cotelê",
    fabric: "cotele",
    description: "Veludo cotelê verde-caça, bordado creme e couro tabaco.",
    colors: {
      crown: "#2f3b2c",
      underbrim: "#1f1612",
      stitch: "#4d5b47",
      embroidery: "#e8dcc0",
      leather: "#5a3a22",
      metal: "#b9975b",
      lining: "#faf6f0",
      sweatband: "#ece4d4",
      labelBg: "#1f1612",
      labelInk: "#d4af37",
    },
  },
};

export const EDITION_ORDER: readonly EditionId[] = ["black", "sand", "hunter"];
