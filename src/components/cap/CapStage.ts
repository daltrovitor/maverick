// Hello World
/**
 * Cena WebGL do boné principal (dad hat preto com o "B" bordado).
 *
 * Geometria procedural calibrada pela foto frontal; o bordado é a própria fotografia
 * recortada (cor + relevo), aplicada sobre os gomos frontais. Partes que não aparecem na
 * foto (traseira, forro) seguem a construção convencional de um dad hat, sem logos.
 *
 * A pose base vem da rolagem (setPose); o usuário pode girar (arraste/teclado) e aproximar
 * (botões/pinça) por cima dela. A cena só renderiza quando algo muda.
 */
import {
  Box3,
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
  PMREMGenerator,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
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
import { createTwillBump, createWashedFabricMap } from "@/components/cap/capTextures";

export type PartId = "botao" | "copa" | "bordado" | "aba" | "subaba" | "forro" | "faixa" | "fecho";
export type AnchorId = "bordado" | "ilhos" | "aba" | "botao" | "costura" | "fecho";

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export interface Pose {
  /** Rotação horizontal (rad). 0 = frente para a câmera. */
  yaw: number;
  /** Inclinação (rad). Positivo mostra mais o topo, como na foto de produto. */
  pitch: number;
  /** Vista explodida 0..1. */
  explode: number;
  /** Aproximação da câmera (1 = enquadramento padrão). */
  zoom: number;
  /** Deslocamento vertical do boné no quadro (unidades do modelo). */
  lift: number;
  /** Deslocamento horizontal do boné no quadro (unidades do modelo). */
  shift: number;
}

export interface CapStageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion: boolean;
  readonly quality: "high" | "low";
  readonly onFrame?: (anchors: Readonly<Record<AnchorId, ProjectedPoint>>) => void;
  readonly onInteract?: () => void;
}

/* Cores medidas na foto do produto (sarja preta lavada, linha cinza, bordado vermelho e branco). */
const PALETTE = {
  fabric: "#242424",
  brim: "#2e2e2e",
  underbrim: "#1a1a1a",
  thread: "#5d5955",
  eyelet: "#151515",
  metal: "#3c3a38",
  lining: "#262422",
  sweatband: "#1b1a19",
} as const;

const ANCHOR_IDS: readonly AnchorId[] = ["bordado", "ilhos", "aba", "botao", "costura", "fecho"];
const PART_IDS: readonly PartId[] = ["botao", "copa", "bordado", "aba", "subaba", "forro", "faixa", "fecho"];

const EXPLODE_OFFSETS: Readonly<Record<PartId, Vector3>> = {
  botao: new Vector3(0, 1.15, 0),
  copa: new Vector3(0, 0.55, 0),
  bordado: new Vector3(0, 0.6, 0.75),
  fecho: new Vector3(0.1, 0.32, -1.05),
  forro: new Vector3(0, -0.1, 0),
  faixa: new Vector3(0, -0.5, 0),
  aba: new Vector3(0, -0.85, 0.2),
  subaba: new Vector3(0, -1.15, 0.28),
};

const PITCH_LIMIT = { min: -0.45, max: 0.85 } as const;
const ZOOM_LIMIT = { min: 0.8, max: 1.8 } as const;

interface Anchor {
  readonly part: PartId;
  readonly point: Vector3;
  readonly normal: Vector3 | null;
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Posiciona o bordado com a proporção da foto. `verticalComp` compensa a inclinação da frente
 * da copa na vista de referência (frontal, levemente de cima), para o "B" projetado ter a
 * mesma proporção da fotografia.
 */
function embroideryBounds(
  aspect: number,
  v0: number,
  v1: number,
  verticalComp = 1,
): { u0: number; u1: number; v0: number; v1: number } {
  let height = 0;
  let prev = crownPoint(0.5, v0);
  for (let k = 1; k <= 48; k += 1) {
    const p = crownPoint(0.5, v0 + ((v1 - v0) * k) / 48);
    height += p.distanceTo(prev);
    prev = p;
  }
  const target = (height * aspect) / verticalComp;
  const vm = (v0 + v1) / 2;
  const arc = (du: number) => {
    let length = 0;
    let last = crownPoint(0.5 - du, vm);
    for (let k = 1; k <= 48; k += 1) {
      const p = crownPoint(0.5 - du + (2 * du * k) / 48, vm);
      length += p.distanceTo(last);
      last = p;
    }
    return length;
  };
  let lo = 0.005;
  let hi = 0.24;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (arc(mid) < target) lo = mid;
    else hi = mid;
  }
  const du = (lo + hi) / 2;
  return { u0: 0.5 - du, u1: 0.5 + du, v0, v1 };
}

export class CapStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  // Teleobjetiva (FOV estreito), como em foto de produto: evita que a aba pareça maior por perspectiva.
  private readonly camera = new PerspectiveCamera(14, 1, 0.1, 120);
  private readonly pivot = new Group();
  private readonly capRoot = new Group();
  private readonly parts = {} as Record<PartId, Group>;
  private readonly anchors = {} as Record<AnchorId, Anchor>;
  private readonly disposables: Array<BufferGeometry | Material | Texture> = [];
  private readonly options: CapStageOptions;

  private width = 1;
  private height = 1;
  /** Largura do modelo (vista frontal, sem explosão) e largura desejada na tela em px. */
  private modelWidth = 2;
  private modelHeight = 1.6;
  private frameWidthPx: number | null = null;
  private active = false;
  private dirty = true;
  private lastTime = 0;

  private readonly base: Pose = { yaw: 0, pitch: 0.2, explode: 0, zoom: 1, lift: 0, shift: 0 };
  private readonly current: Pose = { yaw: 0, pitch: 0.2, explode: 0, zoom: 1, lift: 0, shift: 0 };
  private userYaw = 0;
  private userPitch = 0;
  private userZoom = 1;
  private velocityYaw = 0;
  private sway = true;
  private swayTime = 0;
  private userDecay = false;

  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private zoomAtPinch = 1;
  private lastMove = { x: 0, t: 0 };

  constructor(options: CapStageOptions) {
    this.options = options;
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: options.quality === "high",
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.quality === "high" ? 2 : 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    const pmrem = new PMREMGenerator(this.renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.38;
    this.disposables.push(environment);

    // Luz de estúdio suave vinda de cima/frente, como na foto do produto.
    const hemi = new HemisphereLight(0xffffff, 0xd8d2ca, 0.7);
    const key = new DirectionalLight(0xffffff, 2.1);
    key.position.set(-2.6, 5.2, 5);
    const fill = new DirectionalLight(0xf2f0ee, 0.75);
    fill.position.set(3.4, 1.2, 4.2);
    const rim = new DirectionalLight(0xffffff, 0.9);
    rim.position.set(2.5, 3, -4.5);
    this.scene.add(hemi, key, fill, rim);

    this.camera.position.set(0, 0.35, 7);
    this.sway = !options.reducedMotion;
    this.attachInput(options.canvas);
  }

  private track<T extends BufferGeometry | Material | Texture>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  /** Carrega as texturas do bordado (recortadas da foto) e monta o modelo. */
  async load(): Promise<void> {
    const loader = new TextureLoader();
    const [embroideryMap, embroideryHeight] = await Promise.all([
      loader.loadAsync("/models/red-sox-b/embroidery.png"),
      loader.loadAsync("/models/red-sox-b/embroidery-height.png"),
    ]);
    embroideryMap.colorSpace = SRGBColorSpace;
    embroideryMap.anisotropy = 8;
    embroideryHeight.colorSpace = LinearSRGBColorSpace;
    this.track(embroideryMap);
    this.track(embroideryHeight);
    const image = embroideryMap.image as { width: number; height: number };
    this.build(embroideryMap, embroideryHeight, image.width / image.height);
    this.dirty = true;
  }

  private part(id: PartId): Group {
    const group = new Group();
    group.name = id;
    this.parts[id] = group;
    this.capRoot.add(group);
    return group;
  }

  private build(embroideryMap: Texture, embroideryHeight: Texture, aspect: number): void {
    const high = this.options.quality === "high";
    const twill = this.track(createTwillBump());
    const crownTwill = twill.clone();
    crownTwill.repeat.set(26, 9);
    crownTwill.needsUpdate = true;
    this.track(crownTwill);
    const washed = this.track(createWashedFabricMap(PALETTE.fabric));
    washed.repeat.set(3, 1.4);

    const fabric = (color: string) =>
      this.track(
        new MeshPhysicalMaterial({
          color: new Color(color),
          map: washed,
          roughness: 0.93,
          sheen: 0.55,
          sheenColor: new Color("#5a5a5a"),
          sheenRoughness: 0.6,
          bumpMap: crownTwill,
          bumpScale: 0.9,
          side: DoubleSide,
        }),
      );
    const crownMat = fabric(PALETTE.fabric);
    const brimMat = fabric(PALETTE.brim);
    const underMat = fabric(PALETTE.underbrim);
    const threadMat = this.track(new MeshStandardMaterial({ color: PALETTE.thread, roughness: 0.75 }));
    const dashed = this.track(
      new LineDashedMaterial({ color: PALETTE.thread, dashSize: 0.02, gapSize: 0.011, transparent: true, opacity: 0.95 }),
    );
    const eyeletMat = this.track(new MeshStandardMaterial({ color: PALETTE.eyelet, roughness: 0.55 }));
    const holeMat = this.track(new MeshBasicMaterial({ color: 0x050505 }));
    const metalMat = this.track(new MeshStandardMaterial({ color: PALETTE.metal, roughness: 0.32, metalness: 1 }));
    const liningMat = this.track(new MeshPhysicalMaterial({ color: PALETTE.lining, roughness: 0.7, sheen: 0.25, side: BackSide }));
    const sweatMat = this.track(new MeshPhysicalMaterial({ color: PALETTE.sweatband, roughness: 0.65, sheen: 0.4, side: DoubleSide }));
    const embroideryMat = this.track(
      new MeshStandardMaterial({
        map: embroideryMap,
        // A foto já traz a luz do bordado: escurecemos a base para não "lavar" o vermelho.
        color: new Color("#c8c8c8"),
        alphaTest: 0.4,
        roughness: 0.62,
        metalness: 0,
        bumpMap: embroideryHeight,
        bumpScale: 2.4,
        displacementMap: embroideryHeight,
        displacementScale: 0.022,
        displacementBias: -0.002,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );

    const dashedLine = (points: Vector3[]) => {
      const geometry = this.track(new BufferGeometry().setFromPoints(points));
      const line = new Line(geometry, dashed);
      line.computeLineDistances();
      return line;
    };

    // Copa: seis gomos, costuras com pesponto duplo, ilhoses bordados e debrum do arco traseiro.
    const copa = this.part("copa");
    copa.add(new Mesh(this.track(buildCrownGeometry()), crownMat));
    for (const u of SEAM_US) {
      copa.add(new Mesh(this.track(buildSeamTube(u)), crownMat));
      copa.add(dashedLine(seamPoints(u, 0.0068, 0.0035)));
      copa.add(dashedLine(seamPoints(u, -0.0068, 0.0035)));
    }
    copa.add(new Mesh(this.track(buildArchBindingTube()), crownMat));
    const eyeletGeometry = this.track(new TorusGeometry(0.026, 0.008, 8, high ? 28 : 16));
    const holeGeometry = this.track(new CircleGeometry(0.02, 18));
    const zAxis = new Vector3(0, 0, 1);
    for (let k = 0; k < 6; k += 1) {
      const u = (0.5 + 1 / 12 + k / 6) % 1;
      const v = 0.74;
      const q = new Quaternion().setFromUnitVectors(zAxis, crownNormal(u, v));
      const eyelet = new Mesh(eyeletGeometry, eyeletMat);
      eyelet.position.copy(crownOffsetPoint(u, v, 0.004));
      eyelet.quaternion.copy(q);
      const hole = new Mesh(holeGeometry, holeMat);
      hole.position.copy(crownOffsetPoint(u, v, 0.0015));
      hole.quaternion.copy(q);
      copa.add(eyelet, hole);
    }

    // Botão forrado no topo.
    const botao = this.part("botao");
    const apex = crownPoint(0, 1);
    const button = new Mesh(this.track(new SphereGeometry(0.08, 28, 14)), crownMat);
    button.position.set(apex.x, apex.y + 0.012, apex.z);
    button.scale.set(1, 0.45, 1);
    botao.add(button);

    // Bordado frontal: recorte da foto real com relevo por deslocamento.
    const bounds = embroideryBounds(aspect, 0.17, 0.64, 1.2);
    const bordado = this.part("bordado");
    bordado.add(
      new Mesh(
        this.track(
          buildCrownPatch({
            ...bounds,
            segmentsU: high ? 140 : 70,
            segmentsV: high ? 170 : 86,
            offset: 0.009,
            cutArch: false,
            flipU: true,
          }),
        ),
        embroideryMat,
      ),
    );

    // Aba curva com pespontos concêntricos e sub-aba.
    const aba = this.part("aba");
    aba.add(new Mesh(this.track(buildBrimGeometry()), brimMat));
    for (const row of brimStitchRows(8, 0.052)) aba.add(dashedLine(row));
    const subaba = this.part("subaba");
    subaba.add(new Mesh(this.track(buildUnderbrimGeometry()), underMat));

    // Interior: forro e faixa de conforto.
    const forro = this.part("forro");
    forro.add(new Mesh(this.track(buildCrownGeometry(-0.014)), liningMat));
    const archU = CAP.archHalfAngle / (Math.PI * 2);
    const faixa = this.part("faixa");
    faixa.add(new Mesh(this.track(buildBand(archU, 1 - archU, 0, 0.15, -0.02, 140)), sweatMat));

    // Traseira convencional: tira do mesmo tecido com regulador metálico discreto.
    const fecho = this.part("fecho");
    const strapSpan = archU * 1.5;
    fecho.add(new Mesh(this.track(buildBand(1 - strapSpan, 1 + strapSpan, 0.035, 0.105, 0.013, 48)), crownMat));
    const buckleU = 0.05;
    const buckleV = 0.07;
    const buckleNormal = crownNormal(buckleU, buckleV);
    const bucklePos = crownOffsetPoint(buckleU, buckleV, 0.026);
    const buckleTarget = bucklePos.clone().add(buckleNormal);
    for (const geometry of [buildBuckleGeometry(), buildBucklePinGeometry()]) {
      const piece = new Mesh(this.track(geometry), metalMat);
      piece.position.copy(bucklePos);
      piece.lookAt(buckleTarget);
      piece.scale.setScalar(0.85);
      fecho.add(piece);
    }

    // Âncoras para as anotações do plano frontal.
    const tip = brimCenter();
    this.anchors.bordado = { part: "bordado", point: crownOffsetPoint(0.5 + 0.06, 0.5, 0.03), normal: crownNormal(0.5, 0.5) };
    this.anchors.ilhos = {
      part: "copa",
      point: crownOffsetPoint(0.5 + 1 / 12, 0.74, 0.01),
      normal: crownNormal(0.5 + 1 / 12, 0.74),
    };
    this.anchors.aba = { part: "aba", point: tip.clone().add(new Vector3(0.38, 0.02, 0)), normal: new Vector3(0, 1, 0.4).normalize() };
    this.anchors.botao = { part: "botao", point: apex.clone().add(new Vector3(0, 0.06, 0)), normal: null };
    this.anchors.costura = {
      part: "copa",
      point: crownOffsetPoint(0.5 - 1 / 6, 0.5, 0.01),
      normal: crownNormal(0.5 - 1 / 6, 0.5),
    };
    this.anchors.fecho = { part: "fecho", point: bucklePos.clone().addScaledVector(buckleNormal, 0.03), normal: buckleNormal.clone() };

    // Centraliza o boné (caixa delimitadora) no pivô de rotação e mede o enquadramento.
    const box = new Box3().setFromObject(this.capRoot);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    this.modelWidth = size.x;
    this.modelHeight = size.y;
    this.capRoot.position.set(-center.x, -center.y, -center.z);
    this.pivot.add(this.capRoot);
    this.scene.add(this.pivot);
  }

  /* ───────────── Entrada (arraste, pinça, teclado) ───────────── */

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("keydown", this.onKeyDown);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.lastMove = { x: event.clientX, t: performance.now() };
    this.velocityYaw = 0;
    this.sway = false;
    this.userDecay = false;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b) {
        this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAtPinch = this.userZoom;
      }
    }
    this.options.onInteract?.();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b && this.pinchStart > 0) {
        this.setUserZoom(this.zoomAtPinch * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinchStart));
      }
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    const now = performance.now();
    const dt = Math.max(1, now - this.lastMove.t) / 1000;
    this.userYaw += dx * 0.009;
    if (event.pointerType === "mouse") this.userPitch += dy * 0.006;
    this.velocityYaw = (dx * 0.009) / dt;
    this.lastMove = { x: event.clientX, t: now };
    this.dirty = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = 0;
    if (this.options.reducedMotion) this.velocityYaw = 0;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const step = 0.26;
    if (event.key === "ArrowLeft") this.userYaw -= step;
    else if (event.key === "ArrowRight") this.userYaw += step;
    else if (event.key === "ArrowUp") this.userPitch -= step * 0.6;
    else if (event.key === "ArrowDown") this.userPitch += step * 0.6;
    else if (event.key === "+" || event.key === "=") this.setUserZoom(this.userZoom * 1.15);
    else if (event.key === "-") this.setUserZoom(this.userZoom / 1.15);
    else return;
    event.preventDefault();
    this.sway = false;
    this.dirty = true;
    this.options.onInteract?.();
  };

  /* ───────────── API pública ───────────── */

  /** Pose definida pela coreografia de rolagem. */
  setPose(pose: Partial<Pose>, immediate = false): void {
    let changed = false;
    for (const key of Object.keys(pose) as Array<keyof Pose>) {
      const value = pose[key];
      if (value === undefined || Math.abs(this.base[key] - value) < 1e-4) continue;
      this.base[key] = value;
      if (immediate || this.options.reducedMotion) this.current[key] = value;
      changed = true;
    }
    if (changed) {
      // Quando a rolagem avança, a rotação manual volta suavemente à coreografia.
      this.userDecay = true;
      this.dirty = true;
    }
  }

  setUserZoom(zoom: number): void {
    this.userZoom = Math.min(ZOOM_LIMIT.max, Math.max(ZOOM_LIMIT.min, zoom));
    this.dirty = true;
  }

  zoomBy(factor: number): void {
    this.setUserZoom(this.userZoom * factor);
    this.options.onInteract?.();
  }

  resetView(): void {
    this.userYaw = 0;
    this.userPitch = 0;
    this.userZoom = 1;
    this.velocityYaw = 0;
    this.dirty = true;
  }

  setSway(enabled: boolean): void {
    this.sway = enabled && !this.options.reducedMotion;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
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

  /** Renderiza um quadro imediatamente (captura/verificação). */
  renderNow(): void {
    this.applyTransforms();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.setActive(false);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("keydown", this.onKeyDown);
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
  }

  /* ───────────── Loop ───────────── */

  private applyTransforms(): void {
    const c = this.current;
    const pitch = Math.min(PITCH_LIMIT.max, Math.max(PITCH_LIMIT.min, c.pitch + this.userPitch));
    const swayYaw = this.sway ? Math.sin(this.swayTime * 0.5) * 0.14 : 0;
    this.pivot.rotation.set(pitch, c.yaw + this.userYaw + swayYaw, 0, "YXZ");
    this.pivot.position.set(c.shift, c.lift, 0);
    const eased = easeInOutCubic(Math.min(1, Math.max(0, c.explode)));
    for (const id of PART_IDS) this.parts[id]?.position.copy(EXPLODE_OFFSETS[id]).multiplyScalar(eased);

    // Enquadramento: largura-alvo em px (alinhada à foto) ou ajuste à caixa disponível.
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const fitWidthPx = Math.min(this.width * 0.86, (this.height * 0.92 * this.modelWidth) / this.modelHeight);
    const targetPx = Math.min(this.frameWidthPx ?? fitWidthPx, fitWidthPx * 1.15);
    const base = (this.modelWidth * this.height) / (2 * tanHalf * targetPx);
    const distance = (base * (1 + eased * 0.75)) / (c.zoom * this.userZoom);
    const elevation = 0.05;
    this.camera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    this.camera.lookAt(0, -eased * 0.12, 0);
  }

  /** Largura (px) que o boné deve ocupar na vista frontal; null volta ao ajuste automático. */
  setFrameWidth(px: number | null): void {
    this.frameWidthPx = px && px > 0 ? px : null;
    this.dirty = true;
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    let moving = false;

    if (Math.abs(this.velocityYaw) > 0.01 && this.pointers.size === 0) {
      this.userYaw += this.velocityYaw * dt;
      this.velocityYaw *= Math.exp(-4.2 * dt);
      moving = true;
    }
    if (this.userDecay && this.pointers.size === 0) {
      this.userYaw = damp(this.userYaw, 0, 2.2, dt);
      this.userPitch = damp(this.userPitch, 0, 2.2, dt);
      if (Math.abs(this.userYaw) < 1e-3 && Math.abs(this.userPitch) < 1e-3) {
        this.userYaw = 0;
        this.userPitch = 0;
        this.userDecay = false;
      } else moving = true;
    }
    if (this.sway) {
      this.swayTime += dt;
      moving = true;
    }

    for (const key of Object.keys(this.base) as Array<keyof Pose>) {
      const before = this.current[key];
      const lambda = key === "explode" ? 6 : 7.5;
      this.current[key] = damp(before, this.base[key], lambda, dt);
      if (Math.abs(this.current[key] - this.base[key]) < 1e-4) this.current[key] = this.base[key];
      if (this.current[key] !== before) moving = true;
    }

    if (!moving && !this.dirty) return;
    this.dirty = false;
    this.applyTransforms();
    this.renderer.render(this.scene, this.camera);
    this.emitAnchors();
  };

  private readonly scratch = new Vector3();
  private readonly scratchNormal = new Vector3();
  private readonly toCamera = new Vector3();

  private emitAnchors(): void {
    const onFrame = this.options.onFrame;
    if (!onFrame) return;
    const out = {} as Record<AnchorId, ProjectedPoint>;
    for (const id of ANCHOR_IDS) {
      const anchor = this.anchors[id];
      const group = anchor ? this.parts[anchor.part] : undefined;
      if (!anchor || !group) {
        out[id] = { x: 0, y: 0, visible: false };
        continue;
      }
      const world = group.localToWorld(this.scratch.copy(anchor.point));
      let visible = true;
      if (anchor.normal) {
        this.scratchNormal.copy(anchor.normal).applyQuaternion(this.pivot.quaternion);
        this.toCamera.copy(this.camera.position).sub(world).normalize();
        visible = this.scratchNormal.dot(this.toCamera) > 0.15;
      }
      world.project(this.camera);
      out[id] = {
        x: (world.x * 0.5 + 0.5) * this.width,
        y: (-world.y * 0.5 + 0.5) * this.height,
        visible: visible && world.z < 1,
      };
    }
    onFrame(out);
  }
}

/** Testa suporte a WebGL sem criar contexto pesado. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

