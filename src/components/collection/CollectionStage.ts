// Hello World
/**
 * Parede da coleção da página inicial: estábulo de tábuas largas, prateleiras de pinho sobre
 * mão-francesa de ferro e chão de terra com palha. Cada produto vira um boné 3D na sua prateleira
 * (o modelo neutro pintado com a foto; ver capPaint). Passar o cursor acende um lampião sobre o
 * boné; escolher um leva a câmera até ele, que gira sozinho ou com o arraste.
 *
 * Uma cena e um único contexto WebGL para todos os bonés. Só desenha quando algo muda e só
 * enquanto a parede está na tela; libera tudo em dispose().
 */
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type MeshStandardMaterial as StandardMaterial,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CAP_BLANK_MODEL_URL, dressCap, paintCap, type CapPaint } from "@/components/cap/capPaint";
import type { CapLookTextures } from "@/components/cap/productCapTexture";
import { drawStrawFloor, drawWoodGrain, seeded } from "@/components/collection/barnTextures";

export interface CollectionStageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly count: number;
  readonly reducedMotion: boolean;
  readonly quality: "high" | "low";
  readonly onContextLost?: () => void;
  /** Chamado quando a disposição da parede muda (colunas, tamanho): hora de reposicionar os botões. */
  readonly onLayout?: () => void;
}

/** Área da tela em frações (0–1) do canvas. */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Onde fica cada boné na parede inteira: área clicável e ponto da etiqueta (sob a prateleira). */
export interface SlotScreen {
  readonly hit: ScreenRect;
  readonly labelX: number;
  readonly labelY: number;
}

/* ───────────── Medidas (unidades da cena: largura do boné = 1) ───────────── */

/** Modelo normalizado: copa com meia-largura 1 (ver capModelAnchors.ts) → boné com largura 1. */
const CAP_SCALE = 0.5;
const CAP_HEIGHT = 1.378 * CAP_SCALE;
const SLOT_W = 1.56;
const ROW_H = 1.32;
const MAX_COLS = 5;
const SHELF_LEN = 1.36;
const SHELF_DEPTH = 1.02;
const SHELF_THICK = 0.075;
const BOARD_THICK = 0.05;
/** Face da parede (frente das tábuas). */
const WALL_FRONT = 0;
/** Centro do boné em relação à parede: as costas da copa quase encostam nas tábuas. */
const CAP_Z = WALL_FRONT + 0.84;
const FLOOR_DROP = 0.92;
/** A textura de veio cobre 3 × 6 unidades. */
const GRAIN_W = 3;
const GRAIN_H = 6;
const FOV = 30;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Giro de vitrine (três-quartos, como nas fotos) e o giro de quem está sob o lampião. */
const REST_YAW = -0.46;
const HOVER_YAW = -0.16;
const DETAIL_CENTER = -0.3;
const DETAIL_SWING = 0.62;

const KEY_INTENSITY = 2.6;
const LAMP_INTENSITY = 13;

interface Slot {
  readonly root: Group;
  readonly pivot: Group;
  readonly paint: CapPaint;
  readonly base: Vector3;
  yaw: number;
  velocity: number;
  glow: number;
}

interface Rig {
  readonly position: Vector3;
  readonly look: Vector3;
  /** Onde o alvo aparece na tela (coordenadas normalizadas, −1 a 1). */
  x: number;
  y: number;
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Mola criticamente amortecida (sem passar do ponto), por componente. */
function smoothDamp(current: number, target: number, velocity: { v: number }, time: number, dt: number): number {
  const omega = 2 / Math.max(0.0001, time);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity.v + omega * change) * dt;
  velocity.v = (velocity.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Posiciona a caixa e reescreve as UVs para pegar um pedaço do veio (com a fibra no comprimento). */
function plank(
  size: [number, number, number],
  position: [number, number, number],
  tint: Color,
  uv: { u: number; v: number; along: "x" | "y" },
  rotation?: [number, number, number],
): BufferGeometry {
  const geometry = new BoxGeometry(...size);
  const uvs = geometry.getAttribute("uv");
  const length = uv.along === "y" ? size[1] : size[0];
  const across = uv.along === "y" ? size[0] : Math.max(size[1], size[2]);
  for (let i = 0; i < uvs.count; i += 1) {
    const a = uvs.getX(i);
    const b = uvs.getY(i);
    // Fibra da textura corre no eixo v: alinhada ao comprimento da peça.
    const alongT = uv.along === "y" ? b : a;
    const acrossT = uv.along === "y" ? a : b;
    uvs.setXY(i, uv.u + (acrossT * across) / GRAIN_W, uv.v + (alongT * length) / GRAIN_H);
  }
  const colors = new Float32Array(uvs.count * 3);
  for (let i = 0; i < uvs.count; i += 1) colors.set([tint.r, tint.g, tint.b], i * 3);
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const matrix = new Matrix4();
  if (rotation) matrix.makeRotationFromEuler(new Object3D().rotation.set(...rotation));
  matrix.setPosition(...position);
  geometry.applyMatrix4(matrix);
  return geometry;
}

function ironBar(size: [number, number, number], position: [number, number, number], rotationX = 0): BufferGeometry {
  const geometry = new BoxGeometry(...size);
  geometry.deleteAttribute("uv");
  const matrix = new Matrix4().makeRotationX(rotationX);
  matrix.setPosition(...position);
  geometry.applyMatrix4(matrix);
  return geometry;
}

export class CollectionStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 80);
  private readonly probe = new PerspectiveCamera(FOV, 1, 0.1, 80);
  private readonly options: CollectionStageOptions;
  private readonly disposables = new Set<BufferGeometry | Material | Texture>();
  private readonly capTextures = new Set<Texture>();
  private readonly slots: Slot[] = [];

  private readonly key = new SpotLight(0xffe7cc, KEY_INTENSITY, 0, 0.62, 0.95, 0);
  private readonly fill = new DirectionalLight(0x9eb0c6, 0.32);
  private readonly hemi = new HemisphereLight(0xffe2bc, 0x24170c, 0.34);
  private readonly lamp = new SpotLight(0xffdcb0, 0, 0, 0.36, 0.75, 0);

  private wood: MeshStandardMaterial | null = null;
  private iron: MeshStandardMaterial | null = null;
  private fixtures: Mesh[] = [];
  private floor: Mesh | null = null;
  private wall: Mesh | null = null;

  private width = 1;
  private height = 1;
  private cols = 1;
  private rows = 1;
  private safe = { top: 0.2, bottom: 0.12, side: 0.05 };
  private detailFrame: ScreenRect = { left: 0.04, top: 0.14, width: 0.56, height: 0.72 };

  private active = false;
  private dirty = true;
  private shadowsDirty = true;
  private lastTime = 0;
  private clock = 0;

  private hovered: number | null = null;
  private selected: number | null = null;
  private readonly rig: Rig = { position: new Vector3(0, 0, 10), look: new Vector3(), x: 0, y: 0 };
  private readonly rigVelocity = Array.from({ length: 8 }, () => ({ v: 0 }));
  private readonly lampTarget = new Vector3();
  private lampLevel = 0;
  private light = 1;
  private lightFrom = 1;
  private lightStart = -1;
  private lightDuration = 1;

  private readonly pointers = new Map<number, number>();
  private lastMove = 0;
  private idleFor = 10;

  constructor(options: CollectionStageOptions) {
    this.options = options;
    const high = options.quality === "high";
    this.renderer = new WebGLRenderer({ canvas: options.canvas, antialias: high, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.75 : 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(0x140d08, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.16;
    this.disposables.add(environment);

    this.key.castShadow = true;
    this.key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = high ? 4 : 2;
    this.key.shadow.camera.near = 2;
    this.key.shadow.camera.far = 40;
    this.scene.add(this.key, this.key.target, this.fill, this.hemi, this.lamp, this.lamp.target);

    options.canvas.addEventListener("webglcontextlost", this.onContextLost);
    options.canvas.addEventListener("pointerdown", this.onPointerDown);
    options.canvas.addEventListener("pointermove", this.onPointerMove);
    options.canvas.addEventListener("pointerup", this.onPointerUp);
    options.canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  private track<T extends BufferGeometry | Material | Texture>(item: T): T {
    this.disposables.add(item);
    return item;
  }

  /* ───────────── Montagem ───────────── */

  async load(): Promise<void> {
    const high = this.options.quality === "high";
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    // Madeira e palha desenhadas aqui mesmo, enquanto o modelo baixa.
    const modelPromise = new GLTFLoader().loadAsync(CAP_BLANK_MODEL_URL);
    const grain = this.track(new CanvasTexture(drawWoodGrain(high ? 1024 : 512, high ? 2048 : 1024, 7)));
    grain.colorSpace = SRGBColorSpace;
    grain.wrapS = RepeatWrapping;
    grain.wrapT = RepeatWrapping;
    grain.anisotropy = maxAniso;
    const straw = this.track(new CanvasTexture(drawStrawFloor(high ? 1024 : 512, 11)));
    straw.colorSpace = SRGBColorSpace;
    straw.wrapS = RepeatWrapping;
    straw.wrapT = RepeatWrapping;
    straw.anisotropy = maxAniso;

    this.wood = this.track(
      new MeshStandardMaterial({ map: grain, bumpMap: grain, bumpScale: 2.2, vertexColors: true, roughness: 0.9 }),
    );
    this.iron = this.track(new MeshStandardMaterial({ color: 0x1d1915, metalness: 0.7, roughness: 0.46 }));
    const floorMaterial = this.track(new MeshStandardMaterial({ map: straw, bumpMap: straw, bumpScale: 1.5, roughness: 1 }));
    this.floor = new Mesh(this.track(new PlaneGeometry(90, 16)), floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    straw.repeat.set(90 / 3.2, 16 / 3.2);
    this.scene.add(this.floor);

    const gltf = await modelPromise;
    const model = gltf.scene;
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      this.track(object.geometry as BufferGeometry);
      const source = object.material as StandardMaterial;
      this.track(source);
      for (const texture of [source.map, source.normalMap]) {
        if (!texture) continue;
        texture.anisotropy = high ? 8 : 4;
        this.track(texture);
        this.capTextures.add(texture);
      }
    });
    if (!high) await Promise.all([...this.capTextures].map((texture) => this.shrinkTexture(texture, 1024)));

    // Pé do boné na origem do pivô (centro da base), frente (aba) em +Z.
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);

    // Todas as cópias saem do modelo original (ainda com os materiais nomeados por peça): cada
    // boné recebe os seus materiais de tecido. O original fica só como molde.
    const copies = Array.from({ length: this.options.count }, () => model.clone(true));
    for (const copy of copies) {
      const paint = dressCap(copy, (material) => this.track(material));
      paintCap(paint, null);
      copy.traverse((object) => {
        if (object instanceof Mesh) object.castShadow = true;
      });
      const pivot = new Group();
      pivot.scale.setScalar(CAP_SCALE);
      pivot.add(copy);
      const root = new Group();
      root.add(pivot);
      this.scene.add(root);
      this.slots.push({ root, pivot, paint, base: new Vector3(), yaw: REST_YAW, velocity: 0, glow: 0 });
    }
    this.relayout(true);
  }

  private async shrinkTexture(texture: Texture, size: number): Promise<void> {
    const image = texture.image as ImageBitmap | HTMLImageElement | null;
    if (!image || typeof createImageBitmap !== "function" || image.width <= size) return;
    try {
      const smaller = await createImageBitmap(image, { resizeWidth: size, resizeHeight: size, resizeQuality: "high" });
      if (image instanceof ImageBitmap) image.close();
      texture.image = smaller;
      texture.needsUpdate = true;
    } catch {
      // Sem redimensionamento no navegador: segue com a textura original.
    }
  }

  /** Distância da câmera para a parede inteira caber na área livre com `cols` colunas. */
  private wallDistance(cols: number): number {
    const rows = Math.ceil(this.options.count / cols);
    const aspect = this.width / this.height;
    const safeW = 1 - this.safe.side * 2;
    const safeH = 1 - this.safe.top - this.safe.bottom;
    const halfW = (Math.min(cols, this.options.count) * SLOT_W) / 2;
    const contentH = (rows - 1) * ROW_H + CAP_HEIGHT + 0.5;
    return Math.max(halfW / (TAN * aspect * safeW), contentH / 2 / (TAN * safeH));
  }

  /** Escolhe as colunas que deixam os bonés maiores na tela e refaz prateleiras e parede. */
  private relayout(force = false): void {
    const count = this.options.count;
    if (count === 0 || !this.wood || !this.iron) return;
    let best = 1;
    for (let cols = 1; cols <= Math.min(MAX_COLS, count); cols += 1) {
      if (this.wallDistance(cols) < this.wallDistance(best) - 1e-6) best = cols;
    }
    const changed = best !== this.cols || force;
    this.cols = best;
    this.rows = Math.ceil(count / best);
    if (changed) this.buildFixtures();
    this.dirty = true;
    this.shadowsDirty = true;
    this.options.onLayout?.();
  }

  private buildFixtures(): void {
    for (const mesh of this.fixtures) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.fixtures = [];
    const random = seeded(23);
    const woodParts: BufferGeometry[] = [];
    const ironParts: BufferGeometry[] = [];
    const shelfTint = () => new Color(0.74 + random() * 0.1, 0.47 + random() * 0.05, 0.27 + random() * 0.04);

    const topShelf = (this.rows - 1) * ROW_H;
    const floorY = -FLOOR_DROP;
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i]!;
      const row = Math.floor(i / this.cols);
      const inRow = Math.min(this.cols, this.slots.length - row * this.cols);
      const col = i - row * this.cols;
      const x = (col - (inRow - 1) / 2) * SLOT_W;
      const y = topShelf - row * ROW_H;
      slot.base.set(x, y, CAP_Z);
      slot.root.position.copy(slot.base);

      // Prateleira de pinho com a fibra no comprimento.
      woodParts.push(
        plank([SHELF_LEN, SHELF_THICK, SHELF_DEPTH], [x, y - SHELF_THICK / 2, WALL_FRONT + SHELF_DEPTH / 2], shelfTint(), {
          u: random(),
          v: random(),
          along: "x",
        }),
      );
      // Duas mãos-francesas de ferro: chapa na parede, braço sob a tábua e a escora em diagonal.
      for (const side of [-1, 1]) {
        const bx = x + side * SHELF_LEN * 0.32;
        const under = y - SHELF_THICK;
        ironParts.push(ironBar([0.05, 0.46, 0.022], [bx, under - 0.23, WALL_FRONT + 0.011]));
        ironParts.push(ironBar([0.05, 0.028, SHELF_DEPTH * 0.82], [bx, under - 0.014, WALL_FRONT + SHELF_DEPTH * 0.41]));
        const run = SHELF_DEPTH * 0.6;
        const drop = 0.4;
        const length = Math.hypot(run, drop);
        ironParts.push(ironBar([0.04, 0.026, length], [bx, under - drop / 2 - 0.02, WALL_FRONT + run / 2], Math.atan2(drop, run)));
      }
    }

    // Tábuas da parede (verticais, largura e tom variados, frestas escuras entre elas) e a viga do alto.
    const wallTop = topShelf + CAP_HEIGHT + 9;
    const boardH = wallTop - floorY;
    let bx = -36;
    while (bx < 36) {
      const width = 0.46 + random() * 0.34;
      const weathered = random();
      const base = 0.78 + random() * 0.36;
      const tint = new Color(0.3 * base, 0.18 * base, 0.105 * base).lerp(new Color(0.21, 0.19, 0.17).multiplyScalar(base), weathered * 0.45);
      woodParts.push(
        plank(
          [width - 0.014, boardH, BOARD_THICK],
          [bx + width / 2, floorY + boardH / 2, WALL_FRONT - BOARD_THICK / 2 - random() * 0.014],
          tint,
          { u: random(), v: random(), along: "y" },
          [0, (random() - 0.5) * 0.02, 0],
        ),
      );
      bx += width;
    }
    const beamY = topShelf + CAP_HEIGHT + 0.95;
    woodParts.push(
      plank([72, 0.34, 0.26], [0, beamY, WALL_FRONT + 0.13], new Color(0.22, 0.13, 0.075), { u: 0.2, v: 0.4, along: "x" }),
    );
    // Rodapé (soleira) onde a parede encontra o chão.
    woodParts.push(
      plank([72, 0.22, 0.16], [0, floorY + 0.11, WALL_FRONT + 0.08], new Color(0.2, 0.12, 0.07), { u: 0.6, v: 0.1, along: "x" }),
    );
    // Fresta escura atrás das tábuas.
    if (!this.wall) {
      this.wall = new Mesh(this.track(new PlaneGeometry(1, 1)), this.track(new MeshStandardMaterial({ color: 0x060403, roughness: 1 })));
      this.scene.add(this.wall);
    }
    this.wall.scale.set(80, boardH, 1);
    this.wall.position.set(0, floorY + boardH / 2, WALL_FRONT - BOARD_THICK - 0.02);

    const woodMesh = new Mesh(mergeGeometries(woodParts), this.wood!);
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    const ironMesh = new Mesh(mergeGeometries(ironParts), this.iron!);
    ironMesh.castShadow = true;
    ironMesh.receiveShadow = true;
    for (const part of [...woodParts, ...ironParts]) part.dispose();
    this.fixtures = [woodMesh, ironMesh];
    this.scene.add(woodMesh, ironMesh);

    if (this.floor) this.floor.position.set(0, floorY, WALL_FRONT + 8);

    // Luz principal: de cima e da esquerda, como o sol entrando pela porta do estábulo.
    const halfW = (Math.min(this.cols, this.slots.length) * SLOT_W) / 2;
    const midY = topShelf / 2 + CAP_HEIGHT / 2;
    this.key.position.set(-halfW * 0.6 - 2.5, topShelf + 8, 13);
    this.key.target.position.set(halfW * 0.15, midY - 0.4, WALL_FRONT);
    this.key.angle = Math.min(1.1, 0.3 + Math.atan((halfW + 2.5) / 16));
    this.key.shadow.camera.far = 40;
    this.key.shadow.camera.updateProjectionMatrix();
    this.fill.position.set(halfW + 6, midY + 2, 8);
  }

  /* ───────────── Câmera ───────────── */

  private wallRig(target: Rig): void {
    const distance = this.wallDistance(this.cols);
    const topShelf = (this.rows - 1) * ROW_H;
    const top = topShelf + CAP_HEIGHT + 0.12;
    const bottom = -0.38;
    const centerY = (top + bottom) / 2;
    const ndcY = this.safe.bottom - this.safe.top;
    const camY = centerY - ndcY * distance * TAN;
    target.position.set(0, camY, CAP_Z + distance);
    target.look.set(0, camY, CAP_Z);
    target.x = 0;
    target.y = 0;
  }

  private detailRig(index: number, target: Rig): void {
    const slot = this.slots[index];
    if (!slot) return this.wallRig(target);
    const frame = this.detailFrame;
    const aspect = this.width / this.height;
    // Largura efetiva com o giro (a aba aparece de lado) e a altura do boné.
    const distance = Math.max(1.5 / (frame.width * 2 * TAN * aspect), (CAP_HEIGHT + 0.28) / (frame.height * 2 * TAN));
    target.look.set(slot.base.x, slot.base.y + CAP_HEIGHT * 0.46, slot.base.z);
    target.position.set(slot.base.x, slot.base.y + CAP_HEIGHT * 0.46 + distance * 0.2, slot.base.z + distance);
    target.x = (frame.left + frame.width / 2) * 2 - 1;
    target.y = 1 - (frame.top + frame.height / 2) * 2;
  }

  private applyCamera(camera: PerspectiveCamera, rig: Rig): void {
    camera.aspect = this.width / this.height;
    camera.position.copy(rig.position);
    camera.lookAt(rig.look);
    if (Math.abs(rig.x) > 1e-4 || Math.abs(rig.y) > 1e-4) {
      camera.setViewOffset(this.width, this.height, (-rig.x * this.width) / 2, (rig.y * this.height) / 2, this.width, this.height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /* ───────────── Entrada ───────────── */

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.selected === null) return;
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, event.clientX);
    const slot = this.slots[this.selected];
    if (slot) slot.velocity = 0;
    this.idleFor = 0;
    this.lastMove = performance.now();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    const slot = this.selected === null ? undefined : this.slots[this.selected];
    if (previous === undefined || !slot || this.pointers.size > 1) return;
    const now = performance.now();
    const delta = (event.clientX - previous) * 0.009;
    this.pointers.set(event.pointerId, event.clientX);
    const dt = Math.max(1, now - this.lastMove) / 1000;
    this.lastMove = now;
    slot.yaw += delta;
    slot.velocity = delta / dt;
    this.idleFor = 0;
    this.dirty = true;
    this.shadowsDirty = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.options.reducedMotion) {
      const slot = this.selected === null ? undefined : this.slots[this.selected];
      if (slot) slot.velocity = 0;
    }
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.setActive(false);
    this.options.onContextLost?.();
  };

  /* ───────────── API ───────────── */

  /** Áreas reservadas ao texto por cima da parede (frações da altura/largura). */
  setSafeArea(top: number, bottom: number, side: number): void {
    this.safe = { top, bottom, side };
    this.relayout();
  }

  /** Onde o boné escolhido aparece de perto (o resto da tela é do painel). */
  setDetailFrame(frame: ScreenRect): void {
    this.detailFrame = frame;
    this.dirty = true;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.relayout();
    // Sem animação de câmera ao redimensionar: pula direto para o enquadramento novo.
    this.snapCamera();
    this.render();
  }

  setLook(index: number, look: CapLookTextures | null): void {
    const slot = this.slots[index];
    if (!slot) return;
    paintCap(slot.paint, look);
    this.dirty = true;
  }

  setHover(index: number | null): void {
    if (this.hovered === index) return;
    this.hovered = index;
    this.dirty = true;
  }

  select(index: number | null): void {
    if (this.selected === index) return;
    this.selected = index;
    this.idleFor = 0;
    this.clock = 0;
    if (this.options.reducedMotion) this.snapCamera();
    this.dirty = true;
  }

  /** Acende as luzes da parede (a "chegada" da página). */
  lightUp(duration: number): void {
    if (this.options.reducedMotion || duration <= 0) {
      this.light = 1;
      this.lightStart = -1;
    } else {
      this.lightFrom = 0;
      this.light = 0;
      this.lightDuration = duration;
      this.lightStart = performance.now();
    }
    this.dirty = true;
  }

  /** Começa no escuro, esperando lightUp(). */
  darken(): void {
    this.light = 0;
    this.lightStart = -1;
    this.dirty = true;
  }

  /** Onde cada boné fica na tela com a parede inteira (para os botões e as etiquetas por cima). */
  slotScreens(): SlotScreen[] {
    const rig: Rig = { position: new Vector3(), look: new Vector3(), x: 0, y: 0 };
    this.wallRig(rig);
    this.applyCamera(this.probe, rig);
    const point = new Vector3();
    return this.slots.map((slot) => {
      const { x, y } = slot.base;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const dx of [-0.66, 0.66]) {
        for (const dy of [-0.04, CAP_HEIGHT + 0.08]) {
          for (const z of [WALL_FRONT, CAP_Z + 0.75]) {
            point.set(x + dx, y + dy, z).project(this.probe);
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
          }
        }
      }
      point.set(x, y - SHELF_THICK - 0.05, WALL_FRONT + SHELF_DEPTH).project(this.probe);
      return {
        hit: { left: (minX + 1) / 2, top: (1 - maxY) / 2, width: (maxX - minX) / 2, height: (maxY - minY) / 2 },
        labelX: (point.x + 1) / 2,
        labelY: (1 - point.y) / 2,
      };
    });
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

  /** Compila shaders e sobe texturas antes de o canvas aparecer (sem engasgo na entrada). */
  async warmUp(): Promise<void> {
    this.snapCamera();
    this.applyFrame();
    await this.renderer.compileAsync(this.scene, this.camera);
    this.render();
  }

  render(): void {
    this.applyFrame();
    if (this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.setActive(false);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    for (const slot of this.slots) slot.paint.decalTexture?.dispose();
    for (const mesh of this.fixtures) mesh.geometry.dispose();
    for (const item of this.disposables) item.dispose();
    this.key.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /* ───────────── Quadro a quadro ───────────── */

  private snapCamera(): void {
    const target: Rig = { position: new Vector3(), look: new Vector3(), x: 0, y: 0 };
    if (this.selected === null) this.wallRig(target);
    else this.detailRig(this.selected, target);
    this.rig.position.copy(target.position);
    this.rig.look.copy(target.look);
    this.rig.x = target.x;
    this.rig.y = target.y;
    for (const velocity of this.rigVelocity) velocity.v = 0;
    this.dirty = true;
  }

  private applyFrame(): void {
    for (const slot of this.slots) slot.pivot.rotation.set(0, slot.yaw, 0);
    this.applyCamera(this.camera, this.rig);
    const level = this.light;
    this.renderer.toneMappingExposure = 0.04 + 0.96 * level;
    this.key.intensity = KEY_INTENSITY * level;
    this.lamp.intensity = LAMP_INTENSITY * this.lampLevel * level;
    this.lamp.position.set(this.lampTarget.x, this.lampTarget.y + 2.6, this.lampTarget.z + 1.5);
    this.lamp.target.position.copy(this.lampTarget);
    this.lamp.target.updateMatrixWorld();
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    let moving = false;
    const reduced = this.options.reducedMotion;

    // Luzes acendendo.
    if (this.lightStart >= 0) {
      const t = Math.min(1, (now - this.lightStart) / (this.lightDuration * 1000));
      this.light = this.lightFrom + (1 - this.lightFrom) * easeInOut(t);
      if (t >= 1) this.lightStart = -1;
      moving = true;
    }

    // Câmera: mola até a parede inteira ou até o boné escolhido.
    const target: Rig = { position: new Vector3(), look: new Vector3(), x: 0, y: 0 };
    if (this.selected === null) this.wallRig(target);
    else this.detailRig(this.selected, target);
    const values = [this.rig.position.x, this.rig.position.y, this.rig.position.z, this.rig.look.x, this.rig.look.y, this.rig.look.z, this.rig.x, this.rig.y];
    const goals = [target.position.x, target.position.y, target.position.z, target.look.x, target.look.y, target.look.z, target.x, target.y];
    let far = false;
    for (let i = 0; i < values.length; i += 1) {
      const next = reduced ? goals[i]! : smoothDamp(values[i]!, goals[i]!, this.rigVelocity[i]!, 0.62, dt);
      if (Math.abs(next - goals[i]!) > 1e-4 || Math.abs(this.rigVelocity[i]!.v) > 1e-4) far = true;
      values[i] = next;
    }
    this.rig.position.set(values[0]!, values[1]!, values[2]!);
    this.rig.look.set(values[3]!, values[4]!, values[5]!);
    this.rig.x = values[6]!;
    this.rig.y = values[7]!;
    if (far) moving = true;

    // Lampião: sobre o boné escolhido ou o que está sob o cursor.
    const lit = this.selected ?? this.hovered;
    const litSlot = lit === null ? undefined : this.slots[lit];
    const lampGoal = litSlot ? 1 : 0;
    if (litSlot) {
      const goal = new Vector3(litSlot.base.x, litSlot.base.y + CAP_HEIGHT * 0.4, litSlot.base.z);
      if (this.lampLevel < 0.02) this.lampTarget.copy(goal);
      const before = this.lampTarget.clone();
      this.lampTarget.set(damp(before.x, goal.x, 9, dt), damp(before.y, goal.y, 9, dt), damp(before.z, goal.z, 9, dt));
      if (before.distanceToSquared(this.lampTarget) > 1e-8) moving = true;
    }
    const nextLamp = reduced ? lampGoal : damp(this.lampLevel, lampGoal, 7, dt);
    if (Math.abs(nextLamp - this.lampLevel) > 1e-4) moving = true;
    this.lampLevel = Math.abs(nextLamp - lampGoal) < 1e-3 ? lampGoal : nextLamp;

    // Giro dos bonés: vitrine, o do cursor vira para a frente, o escolhido gira devagar.
    this.idleFor += dt;
    this.slots.forEach((slot, i) => {
      const before = slot.yaw;
      if (i === this.selected) {
        if (this.pointers.size === 0 && Math.abs(slot.velocity) > 0.01) {
          slot.yaw += slot.velocity * dt;
          slot.velocity *= Math.exp(-3.5 * dt);
        } else if (this.pointers.size === 0 && !reduced && this.idleFor > 1.2) {
          this.clock += dt;
          let goal = DETAIL_CENTER + DETAIL_SWING * Math.sin(this.clock * 0.45);
          goal += Math.PI * 2 * Math.round((slot.yaw - goal) / (Math.PI * 2));
          slot.yaw = damp(slot.yaw, goal, 1.6, dt);
        }
      } else {
        let goal = i === this.hovered && this.selected === null ? HOVER_YAW : REST_YAW;
        goal += Math.PI * 2 * Math.round((slot.yaw - goal) / (Math.PI * 2));
        slot.yaw = reduced ? goal : damp(slot.yaw, goal, 5, dt);
      }
      if (Math.abs(slot.yaw - before) > 1e-5) {
        moving = true;
        this.shadowsDirty = true;
      }
    });

    if (!moving && !this.dirty) return;
    this.dirty = false;
    this.render();
  };
}
