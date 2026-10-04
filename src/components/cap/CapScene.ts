// Hello World
/**
 * Cena WebGL do boné Maverick: modelo procedural, edições, vista explodida,
 * rotação por arraste com inércia e projeção de hotspots para a camada HTML.
 */
import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  BackSide,
  Group,
  HemisphereLight,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type CanvasTexture,
  type Material,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  brimCenter,
  brimStitchRows,
  buildArchBindingTube,
  buildBand,
  buildBrimGeometry,
  buildBuckleGeometry,
  buildBucklePinGeometry,
  buildCrownGeometry,
  buildCrownPatch,
  buildSeamTube,
  buildUnderbrimGeometry,
  CAP,
  crownNormal,
  crownOffsetPoint,
  crownPoint,
  SEAM_US,
  seamPoints,
} from "@/components/cap/capGeometry";
import {
  createContactShadow,
  createEmbroideryTextures,
  createFabricBump,
  createLabelTexture,
} from "@/components/cap/capTextures";
import { CAP_EDITIONS, type CapEdition, type EditionId, type FabricKind } from "@/components/cap/editions";

export type HotspotId = "bordado" | "fecho" | "forro" | "selo";
export type PartId = "botao" | "copa" | "bordado" | "aba" | "subaba" | "forro" | "faixa" | "fecho" | "selo";

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export interface FrameInfo {
  readonly hotspots: Readonly<Record<HotspotId, ProjectedPoint>>;
  readonly parts: Readonly<Record<PartId, ProjectedPoint>>;
  /** Progresso da vista explodida (0..1). */
  readonly explode: number;
}

export interface CapSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly edition: EditionId;
  readonly reducedMotion: boolean;
  readonly serifFamily: string;
  readonly onFrame?: (frame: FrameInfo) => void;
  readonly onRotate?: (yaw: number, pitch: number) => void;
  readonly onInteract?: () => void;
}

const PITCH_MIN = -0.35;
const PITCH_MAX = 0.75;
const HOTSPOT_IDS: readonly HotspotId[] = ["bordado", "fecho", "forro", "selo"];
const PART_IDS: readonly PartId[] = ["botao", "copa", "bordado", "aba", "subaba", "forro", "faixa", "fecho", "selo"];

/** Deslocamentos da vista explodida: camadas empilhadas na vertical, lidas a partir da vista 3/4. */
const EXPLODE_OFFSETS: Readonly<Record<PartId, Vector3>> = {
  botao: new Vector3(0, 1.05, 0),
  copa: new Vector3(0, 0.5, 0),
  bordado: new Vector3(0, 0.55, 0.7),
  selo: new Vector3(-1.05, 1.02, 0),
  fecho: new Vector3(0.15, 0.3, -1.0),
  forro: new Vector3(0, -0.12, 0),
  faixa: new Vector3(0, -0.55, 0),
  aba: new Vector3(0, -0.85, 0.15),
  subaba: new Vector3(0, -1.12, 0.22),
};

/** Ângulo de câmera canônico para ler a vista explodida. */
const EXPLODE_VIEW = { yaw: -0.34, pitch: 0.24 } as const;

/** Orientação (yaw, pitch) que apresenta cada hotspot de frente para a câmera. */
const FOCUS: Readonly<Record<HotspotId, { yaw: number; pitch: number }>> = {
  bordado: { yaw: 0, pitch: 0.12 },
  fecho: { yaw: Math.PI, pitch: 0.12 },
  forro: { yaw: Math.PI, pitch: -0.12 },
  selo: { yaw: Math.PI / 2, pitch: 0.08 },
};

interface Anchor {
  readonly part: PartId;
  readonly point: Vector3;
  readonly normal: Vector3 | null;
}

interface MaterialSet {
  readonly crown: MeshPhysicalMaterial;
  readonly underbrim: MeshPhysicalMaterial;
  readonly stitch: MeshStandardMaterial;
  readonly stitchLine: LineDashedMaterial;
  readonly embroidery: MeshStandardMaterial;
  readonly leather: MeshStandardMaterial;
  readonly metal: MeshStandardMaterial;
  readonly lining: MeshPhysicalMaterial;
  readonly sweatband: MeshPhysicalMaterial;
  readonly label: MeshStandardMaterial;
  readonly hole: MeshBasicMaterial;
}

type ColorTargets = Record<keyof CapEdition["colors"], Color>;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function wrapAngle(angle: number): number {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

/** Menor diferença angular de `from` até `to`, preservando voltas já dadas. */
function nearestAngle(from: number, to: number): number {
  const tau = Math.PI * 2;
  const delta = ((((to - from) % tau) + tau * 1.5) % tau) - Math.PI;
  return from + delta;
}

export class CapScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(28, 1, 0.1, 60);
  private readonly pivot = new Group();
  private readonly capRoot = new Group();
  private readonly parts = {} as Record<PartId, Group>;
  private readonly materials: MaterialSet;
  private readonly colorTargets: ColorTargets;
  private readonly fabricBumps = new Map<FabricKind, CanvasTexture>();
  private readonly disposables: Array<BufferGeometry | Material | Texture> = [];
  private readonly hotspotAnchors = {} as Record<HotspotId, Anchor>;
  private readonly partAnchors = {} as Record<PartId, Anchor>;

  private embroideryTextures: { map: CanvasTexture; bump: CanvasTexture } | null = null;
  private labelTexture: CanvasTexture | null = null;

  private yaw = -0.62;
  private pitch = 0.2;
  private targetYaw = -0.62;
  private targetPitch = 0.2;
  private velocityYaw = 0;
  private velocityPitch = 0;
  private explode = 0;
  private explodeTarget = 0;
  private cameraDistance = 6.4;
  private width = 1;
  private height = 1;
  private autoRotate: boolean;
  private dragging = false;
  private pointerId: number | null = null;
  private lastPointer = { x: 0, y: 0, t: 0 };
  private lastTime = 0;
  private active = false;
  private dirty = true;
  private colorBlend = 1;
  private lastReportedYaw = Number.NaN;
  private lastReportedPitch = Number.NaN;
  private readonly reducedMotion: boolean;
  private readonly serifFamily: string;
  private readonly options: CapSceneOptions;

  constructor(options: CapSceneOptions) {
    this.options = options;
    this.reducedMotion = options.reducedMotion;
    this.autoRotate = !options.reducedMotion;
    this.serifFamily = options.serifFamily;

    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    const pmrem = new PMREMGenerator(this.renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.42;
    this.disposables.push(environment);

    this.setupLights();
    this.materials = this.createMaterials();
    const edition = CAP_EDITIONS[options.edition];
    this.colorTargets = this.colorsFrom(edition);
    this.applyColorsImmediately();

    this.buildModel(edition);
    this.camera.position.set(0, 0.55, this.cameraDistance);
    this.camera.lookAt(0, 0.08, 0);

    this.attachPointer(options.canvas);
  }

  /* ───────────── Configuração ───────────── */

  private setupLights(): void {
    const hemi = new HemisphereLight(0xfff8ef, 0xd9cfc1, 0.55);
    const key = new DirectionalLight(0xfff1e0, 2.2);
    key.position.set(-3.2, 5, 4.2);
    const rim = new DirectionalLight(0xffffff, 0.75);
    rim.position.set(3.5, 2.2, -4);
    const fill = new DirectionalLight(0xf3ede4, 0.35);
    fill.position.set(2.5, -1.5, 3);
    this.scene.add(hemi, key, rim, fill);
  }

  private track<T extends BufferGeometry | Material | Texture>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  private createMaterials(): MaterialSet {
    const fabric = (sheen: number) =>
      this.track(
        new MeshPhysicalMaterial({
          roughness: 0.9,
          sheen,
          sheenRoughness: 0.55,
          side: DoubleSide,
        }),
      );
    return {
      crown: fabric(0.65),
      underbrim: fabric(0.5),
      stitch: this.track(new MeshStandardMaterial({ roughness: 0.7 })),
      stitchLine: this.track(new LineDashedMaterial({ dashSize: 0.022, gapSize: 0.012, transparent: true, opacity: 0.9 })),
      embroidery: this.track(
        new MeshStandardMaterial({
          transparent: true,
          alphaTest: 0.35,
          roughness: 0.42,
          metalness: 0.05,
          bumpScale: 3.2,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      ),
      leather: this.track(new MeshStandardMaterial({ roughness: 0.48, metalness: 0.02, side: DoubleSide, bumpScale: 0.6 })),
      metal: this.track(new MeshStandardMaterial({ roughness: 0.28, metalness: 1 })),
      lining: this.track(new MeshPhysicalMaterial({ roughness: 0.62, sheen: 0.25, sheenRoughness: 0.7, side: BackSide })),
      sweatband: this.track(new MeshPhysicalMaterial({ roughness: 0.62, sheen: 0.5, side: DoubleSide })),
      label: this.track(new MeshStandardMaterial({ roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, side: DoubleSide })),
      hole: this.track(new MeshBasicMaterial({ color: 0x120d0a })),
    };
  }

  private colorsFrom(edition: CapEdition): ColorTargets {
    const entries = Object.entries(edition.colors).map(([key, value]) => [key, new Color(value)]);
    return Object.fromEntries(entries) as ColorTargets;
  }

  private colorPairs(): Array<[Color, Color]> {
    const m = this.materials;
    const t = this.colorTargets;
    return [
      [m.crown.color, t.crown],
      [m.underbrim.color, t.underbrim],
      [m.stitch.color, t.stitch],
      [m.stitchLine.color, t.stitch],
      [m.leather.color, t.leather],
      [m.metal.color, t.metal],
      [m.lining.color, t.lining],
      [m.sweatband.color, t.sweatband],
    ];
  }

  private applyColorsImmediately(): void {
    for (const [current, target] of this.colorPairs()) current.copy(target);
    this.materials.crown.sheenColor.copy(this.colorTargets.crown).offsetHSL(0, -0.05, 0.18);
    this.materials.underbrim.sheenColor.copy(this.colorTargets.underbrim).offsetHSL(0, 0, 0.12);
  }

  private fabricBump(kind: FabricKind): CanvasTexture {
    let texture = this.fabricBumps.get(kind);
    if (!texture) {
      texture = this.track(createFabricBump(kind));
      this.fabricBumps.set(kind, texture);
    }
    return texture;
  }

  private applyEditionTextures(edition: CapEdition): void {
    const bump = this.fabricBump(edition.fabric);
    const crownBump = bump.clone();
    crownBump.repeat.set(edition.fabric === "cotele" ? 10 : 14, 5);
    crownBump.needsUpdate = true;
    this.track(crownBump);
    const previousCrownBump = this.materials.crown.bumpMap;
    this.materials.crown.bumpMap = crownBump;
    this.materials.crown.bumpScale = edition.fabric === "cotele" ? 2.2 : edition.fabric === "sarja" ? 1.2 : 0.9;
    this.materials.crown.sheen = edition.fabric === "sarja" ? 0.45 : 0.9;
    this.materials.crown.needsUpdate = true;
    if (previousCrownBump && previousCrownBump !== crownBump) previousCrownBump.dispose();

    this.materials.underbrim.bumpMap = crownBump;
    this.materials.underbrim.bumpScale = this.materials.crown.bumpScale * 0.6;
    this.materials.underbrim.needsUpdate = true;

    const leatherBump = this.fabricBump("camurca");
    this.materials.leather.bumpMap = leatherBump;

    this.embroideryTextures?.map.dispose();
    this.embroideryTextures?.bump.dispose();
    this.embroideryTextures = createEmbroideryTextures(edition.colors.embroidery);
    this.materials.embroidery.map = this.embroideryTextures.map;
    this.materials.embroidery.bumpMap = this.embroideryTextures.bump;
    this.materials.embroidery.needsUpdate = true;

    this.labelTexture?.dispose();
    this.labelTexture = createLabelTexture(edition.colors.labelBg, edition.colors.labelInk, this.serifFamily);
    this.materials.label.map = this.labelTexture;
    this.materials.label.needsUpdate = true;
  }

  /* ───────────── Modelo ───────────── */

  private part(id: PartId): Group {
    const group = new Group();
    group.name = id;
    this.parts[id] = group;
    this.capRoot.add(group);
    return group;
  }

  private dashedLine(points: Vector3[]): Line {
    const geometry = this.track(new BufferGeometry().setFromPoints(points));
    const line = new Line(geometry, this.materials.stitchLine);
    line.computeLineDistances();
    return line;
  }

  private buildModel(edition: CapEdition): void {
    const m = this.materials;

    // Copa: casca externa, costuras, pespontos, ilhoses e debrum do arco.
    const copa = this.part("copa");
    copa.add(new Mesh(this.track(buildCrownGeometry()), m.crown));
    for (const u of SEAM_US) {
      copa.add(new Mesh(this.track(buildSeamTube(u)), m.stitch));
      copa.add(this.dashedLine(seamPoints(u, 0.0062, 0.0035)));
      copa.add(this.dashedLine(seamPoints(u, -0.0062, 0.0035)));
    }
    copa.add(new Mesh(this.track(buildArchBindingTube()), m.crown));
    const eyeletGeometry = this.track(new TorusGeometry(0.024, 0.0065, 8, 24));
    const holeGeometry = this.track(new CircleGeometry(0.02, 18));
    const zAxis = new Vector3(0, 0, 1);
    for (let k = 0; k < 6; k += 1) {
      const u = (0.5 + 1 / 12 + k / 6) % 1;
      const v = 0.7;
      const normal = crownNormal(u, v);
      const quaternion = new Quaternion().setFromUnitVectors(zAxis, normal);
      const eyelet = new Mesh(eyeletGeometry, m.stitch);
      eyelet.position.copy(crownOffsetPoint(u, v, 0.004));
      eyelet.quaternion.copy(quaternion);
      const hole = new Mesh(holeGeometry, m.hole);
      hole.position.copy(crownOffsetPoint(u, v, 0.0015));
      hole.quaternion.copy(quaternion);
      copa.add(eyelet, hole);
    }

    // Botão superior forrado.
    const botao = this.part("botao");
    const button = new Mesh(this.track(new SphereGeometry(0.075, 28, 14)), m.crown);
    const apex = crownPoint(0, 1);
    button.position.set(apex.x, apex.y + 0.01, apex.z);
    button.scale.set(1, 0.42, 1);
    botao.add(button);

    // Bordado 3D frontal.
    const bordado = this.part("bordado");
    bordado.add(
      new Mesh(
        this.track(
          buildCrownPatch({
            u0: 0.5 - 0.088,
            u1: 0.5 + 0.088,
            v0: 0.12,
            v1: 0.64,
            segmentsU: 48,
            segmentsV: 48,
            offset: 0.007,
            cutArch: false,
            flipU: true,
          }),
        ),
        m.embroidery,
      ),
    );

    // Aba, sub-aba e pespontos.
    const aba = this.part("aba");
    aba.add(new Mesh(this.track(buildBrimGeometry()), m.crown));
    for (const row of brimStitchRows()) aba.add(this.dashedLine(row));
    const subaba = this.part("subaba");
    subaba.add(new Mesh(this.track(buildUnderbrimGeometry()), m.underbrim));

    // Forro interno e faixa antissuor.
    const forro = this.part("forro");
    forro.add(new Mesh(this.track(buildCrownGeometry(-0.014)), m.lining));
    const archU = CAP.archHalfAngle / (Math.PI * 2);
    const faixa = this.part("faixa");
    faixa.add(new Mesh(this.track(buildBand(archU, 1 - archU, 0, 0.16, -0.02, 140)), m.sweatband));

    // Fecho em couro + fivela.
    const fecho = this.part("fecho");
    const strapSpan = archU * 1.45;
    fecho.add(new Mesh(this.track(buildBand(1 - strapSpan, 1 + strapSpan, 0.03, 0.115, 0.014, 48)), m.leather));
    const buckleU = 0.045;
    const buckleV = 0.072;
    const buckleNormal = crownNormal(buckleU, buckleV);
    const bucklePosition = crownOffsetPoint(buckleU, buckleV, 0.03);
    const buckleTarget = bucklePosition.clone().add(buckleNormal);
    const buckle = new Mesh(this.track(buildBuckleGeometry()), m.metal);
    const pin = new Mesh(this.track(buildBucklePinGeometry()), m.metal);
    for (const piece of [buckle, pin]) {
      piece.position.copy(bucklePosition);
      piece.lookAt(buckleTarget);
      fecho.add(piece);
    }

    // Selo numerado na lateral esquerda.
    const selo = this.part("selo");
    selo.add(
      new Mesh(
        this.track(
          buildCrownPatch({
            u0: 0.75 - 0.036,
            u1: 0.75 + 0.036,
            v0: 0.03,
            v1: 0.145,
            segmentsU: 12,
            segmentsV: 6,
            offset: 0.006,
            cutArch: false,
            flipU: true,
          }),
        ),
        m.label,
      ),
    );

    this.applyEditionTextures(edition);

    // Âncoras dos hotspots (coordenadas locais de cada peça).
    this.hotspotAnchors.bordado = { part: "bordado", point: crownOffsetPoint(0.5, 0.4, 0.04), normal: crownNormal(0.5, 0.4) };
    this.hotspotAnchors.fecho = {
      part: "fecho",
      point: bucklePosition.clone().addScaledVector(buckleNormal, 0.03),
      normal: buckleNormal.clone(),
    };
    this.hotspotAnchors.forro = {
      part: "forro",
      point: crownOffsetPoint(0.5, 0.2, -0.05),
      normal: crownNormal(0.5, 0.2).negate(),
    };
    this.hotspotAnchors.selo = { part: "selo", point: crownOffsetPoint(0.75, 0.088, 0.03), normal: crownNormal(0.75, 0.088) };

    // Âncoras dos rótulos da vista explodida.
    const brimTip = brimCenter();
    this.partAnchors.botao = { part: "botao", point: apex.clone().add(new Vector3(0, 0.06, 0)), normal: null };
    this.partAnchors.copa = { part: "copa", point: crownOffsetPoint(0.64, 0.62, 0.02), normal: null };
    this.partAnchors.bordado = { part: "bordado", point: crownOffsetPoint(0.5, 0.3, 0.02), normal: null };
    this.partAnchors.aba = { part: "aba", point: brimTip.clone().add(new Vector3(0.42, -0.04, 0)), normal: null };
    this.partAnchors.subaba = { part: "subaba", point: brimTip.clone().add(new Vector3(-0.36, -0.08, 0.1)), normal: null };
    this.partAnchors.forro = { part: "forro", point: crownOffsetPoint(0.28, 0.5, -0.02), normal: null };
    this.partAnchors.faixa = { part: "faixa", point: crownOffsetPoint(0.3, 0.06, -0.02), normal: null };
    this.partAnchors.fecho = { part: "fecho", point: crownOffsetPoint(0.97, 0.12, 0.02), normal: null };
    this.partAnchors.selo = { part: "selo", point: crownOffsetPoint(0.75, 0.15, 0.02), normal: null };

    // Sombra de contato (fica fixa enquanto o boné gira).
    const shadowTexture = this.track(createContactShadow());
    const shadow = new Mesh(
      this.track(new PlaneGeometry(4.2, 3.4)),
      this.track(new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.72, 0);
    shadow.renderOrder = -1;
    this.scene.add(shadow);

    // Centraliza a massa do boné (copa + aba) no pivô de rotação.
    this.capRoot.position.set(0, -0.2, -0.42);
    this.pivot.add(this.capRoot);
    this.scene.add(this.pivot);
  }

  /* ───────────── Interação ───────────── */

  private attachPointer(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("lostpointercapture", this.handlePointerUp);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.autoRotate = false;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.lastPointer = { x: event.clientX, y: event.clientY, t: performance.now() };
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    this.options.onInteract?.();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    const now = performance.now();
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    const dt = Math.max(1, now - this.lastPointer.t) / 1000;
    const yawDelta = dx * 0.0085;
    const pitchDelta = event.pointerType === "mouse" ? dy * 0.006 : 0;
    this.targetYaw += yawDelta;
    this.targetPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.targetPitch + pitchDelta));
    this.velocityYaw = yawDelta / dt;
    this.velocityPitch = pitchDelta / dt;
    this.lastPointer = { x: event.clientX, y: event.clientY, t: now };
    this.dirty = true;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    if (this.reducedMotion) {
      this.velocityYaw = 0;
      this.velocityPitch = 0;
    }
  };

  /* ───────────── API pública ───────────── */

  setEdition(id: EditionId): void {
    const edition = CAP_EDITIONS[id];
    const next = this.colorsFrom(edition);
    for (const key of Object.keys(next) as Array<keyof ColorTargets>) this.colorTargets[key].copy(next[key]);
    this.applyEditionTextures(edition);
    this.colorBlend = this.reducedMotion ? 1 : 0;
    if (this.reducedMotion) this.applyColorsImmediately();
    this.dirty = true;
  }

  setExploded(exploded: boolean): void {
    if (exploded && this.explodeTarget === 0) this.setRotation(EXPLODE_VIEW.yaw, EXPLODE_VIEW.pitch);
    this.explodeTarget = exploded ? 1 : 0;
    if (this.reducedMotion) this.explode = this.explodeTarget;
    this.updateCameraDistance();
    this.dirty = true;
  }

  /** Define a rotação alvo (radianos). Yaw é ajustado para o caminho angular mais curto. */
  setRotation(yaw: number, pitch: number): void {
    this.autoRotate = false;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.targetYaw = nearestAngle(this.targetYaw, yaw);
    this.targetPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch));
    if (this.reducedMotion) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    }
    this.dirty = true;
  }

  focus(id: HotspotId): void {
    const target = FOCUS[id];
    this.setRotation(target.yaw, target.pitch);
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotate = enabled && !this.reducedMotion;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.updateCameraDistance(true);
    this.dirty = true;
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.lastTime = performance.now();
      this.dirty = true;
      this.renderer.setAnimationLoop(this.tick);
    } else {
      this.renderer.setAnimationLoop(null);
    }
  }

  dispose(): void {
    this.setActive(false);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointercancel", this.handlePointerUp);
    canvas.removeEventListener("lostpointercapture", this.handlePointerUp);
    this.embroideryTextures?.map.dispose();
    this.embroideryTextures?.bump.dispose();
    this.labelTexture?.dispose();
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
  }

  /* ───────────── Loop ───────────── */

  private updateCameraDistance(immediate = false): void {
    const aspect = this.width / this.height;
    const radius = this.explodeTarget > 0 ? 2.75 : aspect < 1.2 ? 1.78 : 1.62;
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const distance = radius / Math.tan(halfFov) / Math.min(1, aspect * 1.05);
    this.cameraDistance = distance;
    if (immediate) this.camera.position.set(0, 0.55, distance);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    let moving = false;

    // Inércia após soltar o arraste.
    if (!this.dragging && (Math.abs(this.velocityYaw) > 0.01 || Math.abs(this.velocityPitch) > 0.01)) {
      this.targetYaw += this.velocityYaw * dt;
      this.targetPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.targetPitch + this.velocityPitch * dt));
      const decay = Math.exp(-4.5 * dt);
      this.velocityYaw *= decay;
      this.velocityPitch *= decay;
      moving = true;
    }

    if (this.autoRotate && !this.dragging) {
      this.targetYaw += dt * 0.32;
      moving = true;
    }

    const prevYaw = this.yaw;
    const prevPitch = this.pitch;
    this.yaw = damp(this.yaw, this.targetYaw, 9, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 9, dt);
    if (Math.abs(this.yaw - prevYaw) > 1e-5 || Math.abs(this.pitch - prevPitch) > 1e-5) moving = true;

    const prevExplode = this.explode;
    this.explode = damp(this.explode, this.explodeTarget, 6.5, dt);
    if (Math.abs(this.explode - this.explodeTarget) < 1e-4) this.explode = this.explodeTarget;
    if (this.explode !== prevExplode) moving = true;

    const cameraZ = damp(this.camera.position.z, this.cameraDistance, 5, dt);
    if (Math.abs(cameraZ - this.camera.position.z) > 1e-4) {
      this.camera.position.z = cameraZ;
      moving = true;
    }

    if (this.colorBlend < 1) {
      this.colorBlend = Math.min(1, this.colorBlend + dt * 2.8);
      const factor = 1 - Math.exp(-10 * dt);
      for (const [current, target] of this.colorPairs()) current.lerp(target, factor);
      if (this.colorBlend >= 1) this.applyColorsImmediately();
      this.materials.crown.sheenColor.copy(this.materials.crown.color).offsetHSL(0, -0.05, 0.18);
      moving = true;
    }

    if (!moving && !this.dirty) return;
    this.dirty = false;

    this.pivot.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    const eased = easeInOutCubic(this.explode);
    for (const id of PART_IDS) {
      this.parts[id].position.copy(EXPLODE_OFFSETS[id]).multiplyScalar(eased);
    }
    this.camera.lookAt(0, 0.08 - eased * 0.12, 0);
    this.renderer.render(this.scene, this.camera);
    this.emitFrame(eased);
  };

  private readonly scratch = new Vector3();
  private readonly scratchNormal = new Vector3();
  private readonly toCamera = new Vector3();

  private project(anchor: Anchor): ProjectedPoint {
    const group = this.parts[anchor.part];
    const world = group.localToWorld(this.scratch.copy(anchor.point));
    let visible = true;
    if (anchor.normal) {
      this.scratchNormal.copy(anchor.normal).applyQuaternion(this.pivot.quaternion);
      this.toCamera.copy(this.camera.position).sub(world).normalize();
      visible = this.scratchNormal.dot(this.toCamera) > 0.12;
    }
    world.project(this.camera);
    return {
      x: (world.x * 0.5 + 0.5) * this.width,
      y: (-world.y * 0.5 + 0.5) * this.height,
      visible: visible && world.z < 1,
    };
  }

  private emitFrame(explode: number): void {
    const { onFrame, onRotate } = this.options;
    if (onFrame) {
      const hotspots = {} as Record<HotspotId, ProjectedPoint>;
      for (const id of HOTSPOT_IDS) hotspots[id] = this.project(this.hotspotAnchors[id]);
      const parts = {} as Record<PartId, ProjectedPoint>;
      for (const id of PART_IDS) parts[id] = this.project(this.partAnchors[id]);
      onFrame({ hotspots, parts, explode });
    }
    if (onRotate) {
      const yaw = wrapAngle(this.yaw);
      if (Math.abs(yaw - this.lastReportedYaw) > 0.004 || Math.abs(this.pitch - this.lastReportedPitch) > 0.004) {
        this.lastReportedYaw = yaw;
        this.lastReportedPitch = this.pitch;
        onRotate(yaw, this.pitch);
      }
    }
  }
}

export const CAP_PITCH_RANGE = { min: PITCH_MIN, max: PITCH_MAX } as const;
