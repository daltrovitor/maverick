// Hello World
/**
 * Boné 3D da página de produto: o mesmo modelo "Baseball Cap" (Scott VanArsdale, CC BY 4.0) da
 * página inicial, na versão neutra (scripts/build-polo-model.py --blank), pintado com as cores
 * lidas da foto do produto e com o logo da foto projetado na frente da copa, como um decalque.
 *
 * Estúdio fixo (câmera e luzes paradas, o boné gira): arrastar gira com inércia; em repouso o
 * boné balança devagar mostrando a frente (sem isso com movimento reduzido). Só desenha quando
 * algo muda e só enquanto está na tela; libera tudo em dispose().
 */
import {
  Box3,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CAP_BLANK_MODEL_URL, dressCap, paintCap, type CapPaint } from "@/components/cap/capPaint";
import type { CapLookTextures } from "@/components/cap/productCapTexture";

export interface ProductCapStageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion: boolean;
  readonly quality: "high" | "low";
  readonly onInteract?: () => void;
  readonly onContextLost?: () => void;
}

/** Maior extensão do boné na tela (coordenadas normalizadas, 1 = borda). */
const FIT_LIMIT = 0.86;
const LOW_TEXTURE_SIZE = 1024;
const FIT_SAMPLES = 420;
const EL_LIMIT = { min: -0.05, max: 0.8 } as const;
/** Em repouso o boné balança em torno da frente, levemente de três-quartos. */
const IDLE_CENTER = -0.32;
const IDLE_SWING = 0.72;
const IDLE_DELAY_S = 2.6;

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export class ProductCapStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(22, 1, 0.05, 100);
  private readonly pivot = new Group();
  private readonly key = new DirectionalLight(0xffffff, 2.4);
  private readonly fill = new DirectionalLight(0xf6f2ea, 0.9);
  private readonly rim = new DirectionalLight(0xffffff, 1.4);
  private readonly hemi = new HemisphereLight(0xffffff, 0xe9e1d2, 0.5);
  private readonly disposables = new Set<BufferGeometry | Material | Texture>();
  private readonly textures = new Set<Texture>();
  private readonly options: ProductCapStageOptions;

  private paint: CapPaint | null = null;

  private width = 1;
  private height = 1;
  private active = false;
  private dirty = true;
  private lastTime = 0;
  private clock = 0;
  private fitSamples: Float32Array = new Float32Array(0);
  private distance = 8;
  private groundY = -0.7;
  private blob: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null;
  private readonly target = new Vector3();

  /** Giro do boné (rad), elevação da câmera e inércia do arraste. */
  private yaw = IDLE_CENTER;
  private el = 0.24;
  private velocity = 0;
  private idleFor = IDLE_DELAY_S;
  private readonly pointers = new Map<number, Vector2>();
  private lastMove = 0;

  constructor(options: ProductCapStageOptions) {
    this.options = options;
    const high = options.quality === "high";
    this.renderer = new WebGLRenderer({ canvas: options.canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.55;
    this.disposables.add(environment);

    this.key.position.set(-2.4, 4.6, 4.2);
    this.fill.position.set(3.6, 1.2, 3.2);
    this.rim.position.set(0.4, 3.4, -5);
    this.scene.add(this.key, this.fill, this.rim, this.hemi, this.pivot);

    options.canvas.addEventListener("webglcontextlost", this.onContextLost);
    options.canvas.addEventListener("pointerdown", this.onPointerDown);
    options.canvas.addEventListener("pointermove", this.onPointerMove);
    options.canvas.addEventListener("pointerup", this.onPointerUp);
    options.canvas.addEventListener("pointercancel", this.onPointerUp);
    options.canvas.addEventListener("keydown", this.onKeyDown);
    if (options.reducedMotion) this.idleFor = 0;
  }

  private track<T extends BufferGeometry | Material | Texture>(item: T): T {
    this.disposables.add(item);
    return item;
  }

  async load(): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(CAP_BLANK_MODEL_URL);
    const model = gltf.scene;
    const high = this.options.quality === "high";

    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      this.track(object.geometry as BufferGeometry);
      const source = object.material as MeshStandardMaterial;
      this.track(source);
      for (const texture of [source.map, source.normalMap]) {
        if (!texture) continue;
        texture.anisotropy = high ? 8 : 4;
        this.track(texture);
        this.textures.add(texture);
      }
    });
    this.paint = dressCap(model, (material) => this.track(material));

    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    model.position.sub(center);
    this.pivot.add(model);
    this.groundY = box.min.y - center.y - 0.002;
    this.fitSamples = this.sampleVertices(model, center);
    this.blob = this.createContactShadow(size);
    this.scene.add(this.blob);
    if (!high) await Promise.all([...this.textures].map((texture) => this.shrinkTexture(texture, LOW_TEXTURE_SIZE)));
    this.setLook(null);
    this.updateFit();
  }

  /** Aplica as cores e o logo lidos da foto (null = boné neutro, cinza claro). */
  setLook(look: CapLookTextures | null): void {
    if (this.paint) paintCap(this.paint, look);
    this.dirty = true;
  }

  private createContactShadow(size: Vector3): Mesh<PlaneGeometry, MeshBasicMaterial> {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(38,23,10,0.24)");
      gradient.addColorStop(0.45, "rgba(38,23,10,0.13)");
      gradient.addColorStop(1, "rgba(38,23,10,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const map = this.track(new CanvasTexture(canvas));
    map.colorSpace = SRGBColorSpace;
    const material = this.track(new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    const blob = new Mesh(this.track(new PlaneGeometry(1, 1)), material);
    blob.scale.set(size.x * 1.2, size.z * 1.05, 1);
    blob.position.y = this.groundY;
    blob.rotation.x = -Math.PI / 2;
    blob.renderOrder = -1;
    return blob;
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

  private sampleVertices(model: Group, center: Vector3): Float32Array {
    const all: number[] = [];
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const position = (object.geometry as BufferGeometry).getAttribute("position");
      if (!position) return;
      for (let i = 0; i < position.count; i += 1) all.push(position.getX(i), position.getY(i), position.getZ(i));
    });
    const count = all.length / 3;
    const step = Math.max(1, Math.floor(count / FIT_SAMPLES));
    const out: number[] = [];
    for (let i = 0; i < count; i += step) out.push(all[i * 3]! - center.x, all[i * 3 + 1]! - center.y, all[i * 3 + 2]! - center.z);
    return new Float32Array(out);
  }

  private readonly fitPoint = new Vector3();

  /**
   * Distância fixa que mantém o boné inteiro na área em qualquer giro (medida em 16 ângulos):
   * o tamanho na tela não "respira" enquanto ele gira.
   */
  private updateFit(): void {
    if (this.fitSamples.length === 0) return;
    const trial = 10;
    let extent = 0;
    const savedYaw = this.pivot.rotation.y;
    this.placeCamera(trial);
    for (let k = 0; k < 16; k += 1) {
      this.pivot.rotation.set(0, (k / 16) * Math.PI * 2, 0);
      this.pivot.updateMatrixWorld();
      const m = this.pivot.matrixWorld;
      for (let i = 0; i < this.fitSamples.length; i += 3) {
        this.fitPoint.set(this.fitSamples[i]!, this.fitSamples[i + 1]!, this.fitSamples[i + 2]!).applyMatrix4(m).project(this.camera);
        extent = Math.max(extent, Math.abs(this.fitPoint.x), Math.abs(this.fitPoint.y));
      }
    }
    this.pivot.rotation.set(0, savedYaw, 0);
    this.distance = (trial * extent) / FIT_LIMIT;
    this.dirty = true;
  }

  private placeCamera(distance: number): void {
    this.camera.position.set(0, Math.sin(this.el) * distance, Math.cos(this.el) * distance);
    this.camera.lookAt(this.target);
    const reach = 2;
    this.camera.near = Math.max(0.05, distance - reach * 1.5);
    this.camera.far = distance + reach * 2.5;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /* ───────────── Entrada ───────────── */

  private readonly onPointerDown = (event: PointerEvent): void => {
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    this.velocity = 0;
    this.idleFor = 0;
    this.lastMove = performance.now();
    this.options.onInteract?.();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous || this.pointers.size > 1) return;
    const now = performance.now();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    previous.set(event.clientX, event.clientY);
    const dt = Math.max(1, now - this.lastMove) / 1000;
    this.lastMove = now;
    const delta = dx * 0.009;
    this.yaw += delta;
    if (event.pointerType === "mouse") this.el = Math.min(EL_LIMIT.max, Math.max(EL_LIMIT.min, this.el + dy * 0.004));
    this.velocity = delta / dt;
    this.idleFor = 0;
    this.dirty = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.options.reducedMotion) this.velocity = 0;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const step = 0.3;
    if (event.key === "ArrowLeft") this.yaw -= step;
    else if (event.key === "ArrowRight") this.yaw += step;
    else if (event.key === "ArrowUp") this.el = Math.min(EL_LIMIT.max, this.el + step * 0.4);
    else if (event.key === "ArrowDown") this.el = Math.max(EL_LIMIT.min, this.el - step * 0.4);
    else return;
    event.preventDefault();
    this.idleFor = 0;
    this.dirty = true;
    this.options.onInteract?.();
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.setActive(false);
    this.options.onContextLost?.();
  };

  /* ───────────── API ───────────── */

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.updateFit();
    this.render();
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
    this.apply();
    await this.renderer.compileAsync(this.scene, this.camera);
    for (const texture of this.textures) this.renderer.initTexture(texture);
    this.render();
  }

  render(): void {
    this.apply();
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
    canvas.removeEventListener("keydown", this.onKeyDown);
    if (this.paint) this.paint.decalTexture?.dispose();
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
    // Fechar a vista 3D devolve o contexto WebGL (abrir/fechar várias vezes não acumula).
    this.renderer.forceContextLoss();
  }

  private apply(): void {
    this.pivot.rotation.set(0, this.yaw, 0);
    this.pivot.updateMatrixWorld();
    this.placeCamera(this.distance);
    if (this.blob) this.blob.rotation.set(-Math.PI / 2, 0, this.yaw);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    let moving = false;

    if (this.pointers.size === 0 && Math.abs(this.velocity) > 0.01) {
      this.yaw += this.velocity * dt;
      this.velocity *= Math.exp(-3.5 * dt);
      moving = true;
    }
    if (!this.options.reducedMotion && this.pointers.size === 0) {
      this.idleFor += dt;
      if (this.idleFor >= IDLE_DELAY_S && Math.abs(this.velocity) <= 0.05) {
        // Volta suave ao balanço em torno da frente, pelo caminho mais curto.
        this.clock += dt;
        let goal = IDLE_CENTER + IDLE_SWING * Math.sin(this.clock * 0.42);
        goal += Math.PI * 2 * Math.round((this.yaw - goal) / (Math.PI * 2));
        const ease = Math.min(1, (this.idleFor - IDLE_DELAY_S) / 2.5);
        this.yaw = damp(this.yaw, goal, 0.6 + 2.4 * ease, dt);
        moving = true;
      }
    }

    if (!moving && !this.dirty) return;
    this.dirty = false;
    this.render();
  };
}
