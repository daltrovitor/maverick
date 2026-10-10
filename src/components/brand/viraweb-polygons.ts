// Hello World
/** Emblema oficial da ViraWeb (13 polígonos), usado no crédito "Desenvolvido pela Vira Web". */

export const VIRAWEB_VIEWBOX = "0 0 766 621";

export interface VirawebPolygon {
  readonly points: string;
  readonly fill: string;
}

export const VIRAWEB_POLYGONS: readonly VirawebPolygon[] = [
  { points: "2,93.5 84.7,239.5 223.5,92.5", fill: "#132a46" },
  { points: "307,243.5 223.5,92.5 84.7,239.5", fill: "#113f73" },
  { points: "84.7,239.5 200.5,446 307,243.5", fill: "#2965ae" },
  {
    points: "307,243.5 200.5,446 245,527.5 184,527.5 299,616.5 415,525.5 352,524 386.7,465.5 409,421.5",
    fill: "#132a46",
  },
  { points: "489,286.5 409,421.5 386.7,465.5 474,465 529,377", fill: "#f2bf12" },
  { points: "386.7,465.5 430.5,534 474,465", fill: "#e4a009" },
  { points: "529,377 474,465 568.3,465.2", fill: "#edb00e" },
  { points: "386.7,465.5 352,524 415,525.5 299,616.5 480.5,619 430.5,534", fill: "#edb00e" },
  { points: "568.3,465.2 474,465 430.5,534 480.5,619", fill: "#e39907" },
  { points: "585.5,286.2 489,286.5 529,377", fill: "#3aa7d4" },
  { points: "585.5,286.2 529,377 568.3,465.2 637,344", fill: "#246ba6" },
  { points: "763,2 493,99.5 567,151.5 489,286.5 585.5,286.2", fill: "#266ca6" },
  { points: "763,2 585.5,286.2 637,344 696,242.5 764,291.5", fill: "#1958a5" },
];
