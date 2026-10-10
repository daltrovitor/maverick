// Hello World
/**
 * Cena WebGL do boné principal: dad hat Polo preto (seis gomos, pônei bordado na frente,
 * "POLO" bordado atrás, tira com fivela dourada).
 *
 * O boné fica parado e a CÂMERA é dirigida (azimute, elevação, distância, ponto de foco),
 * como num estúdio. As luzes acompanham a câmera para o tecido preto nunca "sumir".
 * Geometria procedural calibrada pelas fotos; bordados traçados a partir das próprias fotos.
 * Renderiza só quando algo muda; respeita movimento reduzido; libera tudo em dispose().
 */
import {
  BackSide,
  Box3,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearSRGBColorSpace,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector2,
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
  CAP,
  crownNormal,
  crownOffsetPoint,
  crownPoint,
  SEAM_US,
  seamPoints,
} from "@/components/cap/capGeometry";
import { stitchMatricesAlong } from "@/components/cap/capStitches";
import { createFabricRoughness, createTwillNormal, createWashedFabricMap } from "@/components/cap/capTextures";

export type AnchorId = "pony" | "brim" | "eyelet" | "seam" | "polo" | "strap" | "buckle" | "button";
export type FocusId = "center" | AnchorId;

/** Estado da câmera e da luz (o que a narrativa controla). */
export interface Rig {
  /** Azimute da câmera em rad (0 = frente; π = traseira). Pode passar de 2π (voltas). */
  az: number;
  /** Elevação da câmera em rad. */
  el: number;
  /** Distância como múltiplo do enquadramento do boné inteiro (1 = inteiro no quadro). */
  dist: number;
  /** Ponto observado, no espaço do modelo centralizado. */
  tx: number;
  ty: number;
  tz: number;
  /** Intensidades relativas das luzes principal, de preenchimento e de recorte. */
  key: number;
  fill: number;
  rim: number;
  exposure: number;
  /** Deslocamento do produto no quadro (fração da largura/altura) para compor com o texto. */
  frameX: number;
  frameY: number;
}

export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export interface CapStageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion: boolean;
  readonly quality: "high" | "low";
  readonly onFrame?: (anchors: Readonly<Record<AnchorId, ProjectedPoint>>) => void;
  readonly onInteract?: () => void;
  readonly onContextLost?: () => void;
}

/* Cores medidas nas fotos de referência. */
const PALETTE = {
  fabric: "#2f2f30",
  brim: "#323233",
  thread: "#3a3a3b",
  eyelet: "#1e1e1f",
  brass: "#b9a382",
  lining: "#262524",
  sweatband: "#1d1c1b",
} as const;

const ANCHOR_IDS: readonly AnchorId[] = ["pony", "brim", "eyelet", "seam", "polo", "strap", "buckle", "button"];

/* Posições dos bordados no boné (u = volta em torno da copa; v = altura), calibradas pelas fotos. */
const PONY = { u: 0.506, v0: 0.3, v1: 0.6, comp: 1.15 } as const;
const POLO = { u: 0.912, v0: 0.47, v1: 0.565, comp: 1 } as const;
const STRAP = { v0: 0.03, v1: 0.17 } as const;
const BUCKLE = { u: 0.94, v: 0.1 } as const;

const EL_LIMIT = { min: -0.25, max: 1.05 } as const;
const ZOOM_LIMIT = { min: 0.75, max: 2.2 } as const;

export const DEFAULT_RIG: Rig = {
  az: 0,
  el: 0.22,
  dist: 1,
  tx: 0,
  ty: 0,
  tz: 0,
  key: 1,
  fill: 0.7,
  rim: 0.8,
  exposure: 1,
  frameX: 0,
  frameY: 0,
};

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Bounds (u0..u1, v0..v1) de um bordado sobre a copa mantendo a proporção da textura. */
function patchBounds(aspect: number, uCenter: number, v0: number, v1: number, comp: number) {
  let height = 0;
  let prev = crownPoint(uCenter, v0);
  for (let k = 1; k <= 48; k += 1) {
    const p = crownPoint(uCenter, v0 + ((v1 - v0) * k) / 48);
    height += p.distanceTo(prev);
    prev = p;
  }
  const target = (height * aspect) / comp;
  const vm = (v0 + v1) / 2;
  const arc = (du: number) => {
    let length = 0;
    let last = crownPoint(uCenter - du, vm);
    for (let k = 1; k <= 48; k += 1) {
      const p = crownPoint(uCenter - du + (2 * du * k) / 48, vm);
      length += p.distanceTo(last);
      last = p;
    }
    return length;
  };
  let lo = 0.002;
  let hi = 0.24;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (arc(mid) < target) lo = mid;
    else hi = mid;
  }
  const du = (lo + hi) / 2;
  return { u0: uCenter - du, u1: uCenter + du, v0, v1 };
}

export class CapStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  // Teleobjetiva leve, como fotografia de produto (sem exagerar a aba por perspectiva).
  private readonly camera = new PerspectiveCamera(20, 1, 0.05, 120);
  private readonly capRoot = new Group();
  private readonly lightRig = new Group();
  private readonly key = new DirectionalLight(0xffffff, 2.2);
  private readonly fill = new DirectionalLight(0xf3f1ee, 0.8);
  private readonly rim = new DirectionalLight(0xffffff, 1.6);
  private readonly hemi = new HemisphereLight(0xffffff, 0xe8e2d8, 0.55);
  private readonly anchors = {} as Record<AnchorId, Vector3>;
  private readonly anchorNormals = {} as Record<AnchorId, Vector3 | null>;
  private readonly disposables: Array<BufferGeometry | Material | Texture> = [];
  private readonly options: CapStageOptions;

  private width = 1;
  private height = 1;
  private active = false;
  private dirty = true;
  private lastTime = 0;
  private modelWidth = 2;
  private modelHeight = 1.6;
  private groundY = -0.7;

  private readonly target: Rig = { ...DEFAULT_RIG };
  private readonly current: Rig = { ...DEFAULT_RIG };
  private userAz = 0;
  private userEl = 0;
  private userZoom = 1;
  private velocityAz = 0;
  private userDecay = false;
  private pointers = new Map<number, Vector2>();
  private pinchStart = 0;
  private zoomAtPinch = 1;
  private lastMoveTime = 0;

  constructor(options: CapStageOptions) {
    this.options = options;
    const high = options.quality === "high";
    this.renderer = new WebGLRenderer({ canvas: options.canvas, antialias: high, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const pmrem = new PMREMGenerator(this.renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.62;
    this.disposables.push(environment);

    // Estúdio: principal suave do alto/esquerda, preenchimento à direita, recorte por trás.
    this.key.position.set(-2.4, 4.6, 4.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    this.key.shadow.camera.left = -2.4;
    this.key.shadow.camera.right = 2.4;
    this.key.shadow.camera.top = 2.4;
    this.key.shadow.camera.bottom = -2.4;
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 14;
    this.key.shadow.radius = 6;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.fill.position.set(3.6, 1.2, 3.2);
    this.rim.position.set(0.4, 3.4, -5);
    this.lightRig.add(this.key, this.fill, this.rim, this.key.target);
    this.scene.add(this.lightRig, this.hemi);

    options.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.attachInput(options.canvas);
  }

  private track<T extends BufferGeometry | Material | Texture>(item: T): T {
    this.disposables.push(item);
    return item;
  }

  /** Carrega as texturas dos bordados e monta o modelo. */
  async load(): Promise<void> {
    const loader = new TextureLoader();
    const load = (file: string) => loader.loadAsync(`/models/polo/${file}`);
    const [pony, ponyHeight, polo, poloHeight] = await Promise.all([
      load("pony.png"),
      load("pony-height.png"),
      load("polo.png"),
      load("polo-height.png"),
    ] as const);
    for (const t of [pony, polo]) {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
    }
    for (const t of [ponyHeight, poloHeight]) t.colorSpace = LinearSRGBColorSpace;
    for (const t of [pony, ponyHeight, polo, poloHeight]) this.track(t);
    const aspect = (t: Texture) => {
      const img = t.image as { width: number; height: number };
      return img.width / img.height;
    };
    this.build({ map: pony, height: ponyHeight, aspect: aspect(pony) }, { map: polo, height: poloHeight, aspect: aspect(polo) });
    this.dirty = true;
  }

  private build(
    pony: { map: Texture; height: Texture; aspect: number },
    polo: { map: Texture; height: Texture; aspect: number },
  ): void {
    const high = this.options.quality === "high";
    const twill = this.track(createTwillNormal(256));
    twill.repeat.set(30, 11);
    const rough = this.track(createFabricRoughness());
    rough.repeat.set(6, 3);
    const washed = this.track(createWashedFabricMap(PALETTE.fabric));
    washed.repeat.set(3, 1.4);

    const fabric = (color: string, normalScale = 0.55) =>
      this.track(
        new MeshPhysicalMaterial({
          color: new Color(color),
          map: washed,
          roughness: 1,
          roughnessMap: rough,
          normalMap: twill,
          normalScale: new Vector2(normalScale, normalScale),
          sheen: 0.85,
          sheenColor: new Color("#808080"),
          sheenRoughness: 0.62,
          side: DoubleSide,
        }),
      );
    const crownMat = fabric(PALETTE.fabric);
    const brimMat = fabric(PALETTE.brim, 0.5);
    const threadMat = this.track(new MeshStandardMaterial({ color: PALETTE.thread, roughness: 0.62 }));
    const eyeletMat = this.track(new MeshStandardMaterial({ color: PALETTE.eyelet, roughness: 0.6 }));
    const holeMat = this.track(new MeshBasicMaterial({ color: 0x070707 }));
    const brassMat = this.track(
      new MeshPhysicalMaterial({ color: PALETTE.brass, metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    );
    const liningMat = this.track(new MeshPhysicalMaterial({ color: PALETTE.lining, roughness: 0.75, sheen: 0.3, side: BackSide }));
    const sweatMat = this.track(new MeshPhysicalMaterial({ color: PALETTE.sweatband, roughness: 0.7, sheen: 0.4, side: DoubleSide }));
    const embroideryMat = (map: Texture, height: Texture) =>
      this.track(
        new MeshPhysicalMaterial({
          map,
          alphaTest: 0.45,
          roughness: 0.6,
          sheen: 0.6,
          sheenColor: new Color("#ffffff"),
          sheenRoughness: 0.5,
          bumpMap: height,
          bumpScale: 1.6,
          displacementMap: height,
          displacementScale: 0.012,
          displacementBias: -0.001,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );

    const add = (group: Group, mesh: Mesh | InstancedMesh, shadow = true) => {
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    // Copa: seis gomos com costuras em relevo, abertura traseira com debrum.
    const crown = new Group();
    add(crown, new Mesh(this.track(high ? buildCrownGeometry() : buildCrownGeometry(0, 128, 48)), crownMat));
    for (const u of SEAM_US) add(crown, new Mesh(this.track(buildSeamTube(u)), crownMat));
    add(crown, new Mesh(this.track(buildArchBindingTube()), crownMat));

    // Ilhoses bordados (um por gomo) e botão forrado.
    const eyeletGeometry = this.track(new TorusGeometry(0.027, 0.0085, 10, high ? 32 : 18));
    const holeGeometry = this.track(new CircleGeometry(0.019, 20));
    const zAxis = new Vector3(0, 0, 1);
    const eyeletU = (k: number) => (0.5 + 1 / 12 + k / 6) % 1;
    for (let k = 0; k < 6; k += 1) {
      const u = eyeletU(k);
      const v = 0.72;
      const q = new Quaternion().setFromUnitVectors(zAxis, crownNormal(u, v));
      const ring = new Mesh(eyeletGeometry, eyeletMat);
      ring.position.copy(crownOffsetPoint(u, v, 0.004));
      ring.quaternion.copy(q);
      const hole = new Mesh(holeGeometry, holeMat);
      hole.position.copy(crownOffsetPoint(u, v, 0.0012));
      hole.quaternion.copy(q);
      add(crown, ring, false);
      crown.add(hole);
    }
    const apex = crownPoint(0, 1);
    const button = new Mesh(this.track(new SphereGeometry(0.085, 32, 16)), crownMat);
    button.position.set(apex.x, apex.y + 0.014, apex.z);
    button.scale.set(1, 0.46, 1);
    add(crown, button);

    // Bordados: pônei (frente) e POLO (traseira), traçados das fotos.
    const ponyBounds = patchBounds(pony.aspect, PONY.u, PONY.v0, PONY.v1, PONY.comp);
    add(
      crown,
      new Mesh(
        this.track(buildCrownPatch({ ...ponyBounds, segmentsU: high ? 80 : 40, segmentsV: high ? 140 : 70, offset: 0.006, cutArch: false, flipU: true })),
        embroideryMat(pony.map, pony.height),
      ),
      false,
    );
    const poloBounds = patchBounds(polo.aspect, POLO.u, POLO.v0, POLO.v1, POLO.comp);
    add(
      crown,
      new Mesh(
        this.track(buildCrownPatch({ ...poloBounds, segmentsU: high ? 140 : 70, segmentsV: high ? 60 : 30, offset: 0.006, cutArch: false, flipU: true })),
        embroideryMat(polo.map, polo.height),
      ),
      false,
    );

    // Aba, sub-aba.
    const brim = new Group();
    add(brim, new Mesh(this.track(buildBrimGeometry(high ? 140 : 90, high ? 28 : 18)), brimMat));

    // Interior visível pela abertura: forro e faixa.
    const inside = new Group();
    inside.add(new Mesh(this.track(buildCrownGeometry(-0.014)), liningMat));
    const archU = CAP.archHalfAngle / (Math.PI * 2);
    inside.add(new Mesh(this.track(buildBand(archU, 1 - archU, 0, 0.15, -0.02, 140)), sweatMat));

    // Tira de ajuste atravessando a abertura e fivela dourada (lado direito, vista de trás).
    const back = new Group();
    const strapSpan = archU * 1.42;
    add(back, new Mesh(this.track(buildBand(1 - strapSpan, 1 + strapSpan, STRAP.v0, STRAP.v1, 0.012, 64)), crownMat));
    // Ponta da tira passando pela fivela.
    add(back, new Mesh(this.track(buildBand(BUCKLE.u - 0.03, BUCKLE.u + 0.012, STRAP.v0 + 0.006, STRAP.v1 - 0.006, 0.024, 16)), crownMat));
    const buckleNormal = crownNormal(BUCKLE.u, BUCKLE.v);
    const bucklePos = crownOffsetPoint(BUCKLE.u, BUCKLE.v, 0.03);
    const up = crownPoint(BUCKLE.u, BUCKLE.v + 0.05).sub(crownPoint(BUCKLE.u, BUCKLE.v - 0.05)).normalize();
    const buckleQ = new Quaternion().setFromRotationMatrix(
      new Matrix4().makeBasis(new Vector3().crossVectors(up, buckleNormal).normalize(), up, buckleNormal),
    );
    const buckleFrame = new Mesh(this.track(buildBuckleGeometry(0.12, 0.2, 0.018)), brassMat);
    const buckleBar = new Mesh(this.track(buildBucklePinGeometry(0.17)), brassMat);
    for (const piece of [buckleFrame, buckleBar]) {
      piece.position.copy(bucklePos);
      piece.quaternion.copy(buckleQ);
      add(back, piece);
    }

    // Pespontos reais: costuras dos gomos (duplos) e fileiras da aba.
    const stitchGeometry = this.track(new SphereGeometry(0.5, 8, 4));
    const stitchMatrices: Matrix4[] = [];
    const center = new Vector3(0, 0.3, 0);
    const crownNormalAt = (p: Vector3) => p.clone().sub(center).normalize();
    const seamOpts = { pitch: 0.017, length: 0.011, width: 0.0042, lift: 0.004 };
    for (const u of SEAM_US) {
      stitchMatricesAlong(seamPoints(u, 0.0075, 0.003, 90), crownNormalAt, seamOpts, stitchMatrices);
      stitchMatricesAlong(seamPoints(u, -0.0075, 0.003, 90), crownNormalAt, seamOpts, stitchMatrices);
    }
    const brimUp = () => new Vector3(0, 1, 0);
    for (const row of brimStitchRows(8)) {
      stitchMatricesAlong(row, brimUp, { pitch: 0.016, length: 0.0105, width: 0.0042, lift: 0.0006 }, stitchMatrices);
    }
    const stitches = new InstancedMesh(stitchGeometry, threadMat, stitchMatrices.length);
    stitchMatrices.forEach((m, i) => stitches.setMatrixAt(i, m));
    stitches.instanceMatrix.needsUpdate = true;
    crown.add(stitches);

    this.capRoot.add(crown, brim, inside, back);

    // Âncoras (antes de centralizar; convertidas abaixo).
    const tip = brimCenter();
    const ponyMid = (PONY.v0 + PONY.v1) / 2;
    const poloMid = (POLO.v0 + POLO.v1) / 2;
    const sideU = 0.5 - 1 / 12 - 1 / 6; // gomo lateral voltado para +x
    const raw: Record<AnchorId, { p: Vector3; n: Vector3 | null }> = {
      pony: { p: crownOffsetPoint(PONY.u, ponyMid, 0.01), n: crownNormal(PONY.u, ponyMid) },
      brim: { p: tip.clone().add(new Vector3(0.18, 0.01, -0.06)), n: new Vector3(0, 1, 0.35).normalize() },
      eyelet: { p: crownOffsetPoint(sideU, 0.72, 0.01), n: crownNormal(sideU, 0.72) },
      seam: { p: crownOffsetPoint(0.5 - 1 / 6, 0.42, 0.006), n: crownNormal(0.5 - 1 / 6, 0.42) },
      polo: { p: crownOffsetPoint(POLO.u, poloMid, 0.01), n: crownNormal(POLO.u, poloMid) },
      strap: { p: crownOffsetPoint(0.985, (STRAP.v0 + STRAP.v1) / 2, 0.02), n: crownNormal(0, 0.08) },
      buckle: { p: bucklePos.clone().addScaledVector(buckleNormal, 0.012), n: buckleNormal.clone() },
      button: { p: apex.clone().add(new Vector3(0, 0.05, 0)), n: null },
    };

    // Centraliza o boné e posiciona o chão de sombra sob a aba.
    const box = new Box3().setFromObject(this.capRoot);
    const c = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    this.modelWidth = size.x;
    this.modelHeight = size.y;
    this.capRoot.position.set(-c.x, -c.y, -c.z);
    this.groundY = box.min.y - c.y - 0.002;
    for (const id of ANCHOR_IDS) {
      this.anchors[id] = raw[id].p.clone().sub(c);
      this.anchorNormals[id] = raw[id].n;
    }
    this.scene.add(this.capRoot);

    const ground = new Mesh(this.track(new PlaneGeometry(12, 12)), this.track(new ShadowMaterial({ opacity: 0.16 })));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = this.groundY;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Posição (espaço da cena) de uma âncora — usada pela narrativa como ponto de foco. */
  anchor(id: FocusId): Vector3 {
    return id === "center" ? new Vector3() : (this.anchors[id]?.clone() ?? new Vector3());
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
    this.pointers.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    this.velocityAz = 0;
    this.userDecay = false;
    this.lastMoveTime = performance.now();
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b) {
        this.pinchStart = a.distanceTo(b);
        this.zoomAtPinch = this.userZoom;
      }
    }
    this.options.onInteract?.();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const now = performance.now();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    previous.set(event.clientX, event.clientY);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b && this.pinchStart > 0) this.setUserZoom(this.zoomAtPinch * (a.distanceTo(b) / this.pinchStart));
      return;
    }
    const dt = Math.max(1, now - this.lastMoveTime) / 1000;
    this.lastMoveTime = now;
    const delta = -dx * 0.0085;
    this.userAz += delta;
    if (event.pointerType === "mouse") this.userEl += dy * 0.005;
    this.velocityAz = delta / dt;
    this.dirty = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = 0;
    if (this.options.reducedMotion) this.velocityAz = 0;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const step = 0.28;
    if (event.key === "ArrowLeft") this.userAz += step;
    else if (event.key === "ArrowRight") this.userAz -= step;
    else if (event.key === "ArrowUp") this.userEl += step * 0.5;
    else if (event.key === "ArrowDown") this.userEl -= step * 0.5;
    else if (event.key === "+" || event.key === "=") this.setUserZoom(this.userZoom * 1.15);
    else if (event.key === "-") this.setUserZoom(this.userZoom / 1.15);
    else return;
    event.preventDefault();
    this.userDecay = false;
    this.dirty = true;
    this.options.onInteract?.();
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.setActive(false);
    this.options.onContextLost?.();
  };

  /* ───────────── API pública ───────────── */

  /** Define o alvo da câmera/luz. `immediate` pula a suavização (primeiro quadro, movimento reduzido). */
  setRig(rig: Partial<Rig>, immediate = false): void {
    let changed = false;
    for (const key of Object.keys(rig) as Array<keyof Rig>) {
      const value = rig[key];
      if (value === undefined || Math.abs(this.target[key] - value) < 1e-5) continue;
      this.target[key] = value;
      if (immediate || this.options.reducedMotion) this.current[key] = value;
      changed = true;
    }
    if (changed) {
      // A rolagem retomou a direção: a rotação manual volta suavemente à coreografia.
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
    this.userAz = 0;
    this.userEl = 0;
    this.userZoom = 1;
    this.velocityAz = 0;
    this.dirty = true;
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

  /** Renderiza imediatamente (capturas de verificação). */
  renderNow(): void {
    this.apply();
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
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    for (const item of this.disposables) item.dispose();
    this.key.shadow.map?.dispose();
    this.renderer.dispose();
  }

  /* ───────────── Loop ───────────── */

  /** Distância que enquadra o boné inteiro na área disponível. */
  private fitDistance(): number {
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const landscape = this.width >= this.height;
    const widthPx = Math.min(this.width * (landscape ? 0.5 : 0.84), (this.height * (landscape ? 0.62 : 0.5) * this.modelWidth) / this.modelHeight);
    return (this.modelWidth * this.height) / (2 * tanHalf * widthPx);
  }

  private apply(): void {
    const c = this.current;
    const az = c.az + this.userAz;
    const el = Math.min(EL_LIMIT.max, Math.max(EL_LIMIT.min, c.el + this.userEl));
    const distance = (this.fitDistance() * c.dist) / this.userZoom;
    const target = new Vector3(c.tx, c.ty, c.tz);
    this.camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * distance,
      target.y + Math.sin(el) * distance,
      target.z + Math.cos(az) * Math.cos(el) * distance,
    );
    this.camera.lookAt(target);
    // Desloca o produto no quadro para compor com o texto (sem mover a câmera).
    this.camera.setViewOffset(this.width, this.height, -c.frameX * this.width * 0.5, c.frameY * this.height * 0.5, this.width, this.height);

    // Luzes seguem a câmera em torno do eixo vertical: o preto nunca fica sem forma.
    this.lightRig.rotation.y = az;
    this.key.intensity = 2.9 * c.key;
    this.fill.intensity = 1.05 * c.fill;
    this.rim.intensity = 1.7 * c.rim;
    this.hemi.intensity = 0.12 + 0.6 * c.fill;
    // A luz ambiente acompanha a principal: na abertura o boné surge como silhueta recortada.
    this.scene.environmentIntensity = 0.1 + 0.52 * Math.min(1.1, c.key);
    this.renderer.toneMappingExposure = c.exposure * 1.12;
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    let moving = false;

    if (Math.abs(this.velocityAz) > 0.01 && this.pointers.size === 0) {
      this.userAz += this.velocityAz * dt;
      this.velocityAz *= Math.exp(-4 * dt);
      moving = true;
    }
    if (this.userDecay && this.pointers.size === 0 && (this.userAz !== 0 || this.userEl !== 0)) {
      this.userAz = damp(this.userAz, 0, 1.6, dt);
      this.userEl = damp(this.userEl, 0, 1.6, dt);
      if (Math.abs(this.userAz) < 1e-3 && Math.abs(this.userEl) < 1e-3) {
        this.userAz = 0;
        this.userEl = 0;
      }
      moving = true;
    }
    for (const key of Object.keys(this.target) as Array<keyof Rig>) {
      const before = this.current[key];
      this.current[key] = damp(before, this.target[key], 6, dt);
      if (Math.abs(this.current[key] - this.target[key]) < 1e-5) this.current[key] = this.target[key];
      if (this.current[key] !== before) moving = true;
    }

    if (!moving && !this.dirty) return;
    this.dirty = false;
    this.apply();
    this.renderer.render(this.scene, this.camera);
    this.emitAnchors();
  };

  private readonly scratch = new Vector3();
  private readonly toCamera = new Vector3();

  private emitAnchors(): void {
    const onFrame = this.options.onFrame;
    if (!onFrame) return;
    const out = {} as Record<AnchorId, ProjectedPoint>;
    for (const id of ANCHOR_IDS) {
      const p = this.anchors[id];
      if (!p) {
        out[id] = { x: 0, y: 0, visible: false };
        continue;
      }
      const n = this.anchorNormals[id];
      let visible = true;
      if (n) {
        this.toCamera.copy(this.camera.position).sub(p).normalize();
        visible = n.dot(this.toCamera) > 0.2;
      }
      this.scratch.copy(p).project(this.camera);
      out[id] = {
        x: (this.scratch.x * 0.5 + 0.5) * this.width,
        y: (-this.scratch.y * 0.5 + 0.5) * this.height,
        visible: visible && this.scratch.z < 1 && Math.abs(this.scratch.x) < 1 && Math.abs(this.scratch.y) < 1,
      };
    }
    onFrame(out);
  }
}

/** Testa suporte a WebGL sem manter contexto. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
