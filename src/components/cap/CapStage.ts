// Hello World
/**
 * Cena WebGL do boné principal: o modelo "Baseball Cap" (Scott VanArsdale, CC BY 4.0) com a
 * textura trocada pela do boné Polo preto (tecido medido nas fotos + bordados recortados das
 * fotos; ver scripts/build-polo-model.py).
 *
 * Duas camadas de movimento:
 * - CÂMERA dirigida como num estúdio (azimute, elevação, distância, foco) com luzes que a
 *   acompanham, para o tecido preto nunca "sumir";
 * - POSE do próprio boné (inclinação, rolagem, giro, elevação), mais a entrada, a flutuação
 *   e a leve inclinação na direção do cursor.
 * Respeita movimento reduzido (sem flutuação nem entrada); libera tudo em dispose().
 *
 * Qualidade "low" (celular): sem mapa de sombra (uma sombra de contato desenhada substitui a
 * segunda passada do modelo inteiro) e texturas reduzidas a 1024² antes de subir para a GPU.
 */
import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
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
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MODEL_ANCHORS, type ModelAnchorId } from "@/components/cap/capModelAnchors";
import { CAP_MODEL_URL } from "@/components/cap/capModelUrl";

export { CAP_MODEL_URL };

export type AnchorId = ModelAnchorId;
export type FocusId = "center" | AnchorId;

/** Estado da câmera, da luz e da pose do boné (o que a narrativa controla). */
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
  /** Deslocamento do produto no quadro (fração da largura/altura). */
  frameX: number;
  frameY: number;
  /** Pose do boné: inclinação para a frente, rolagem lateral, giro extra (rad) e elevação. */
  tilt: number;
  roll: number;
  spin: number;
  lift: number;
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

const ANCHOR_IDS = Object.keys(MODEL_ANCHORS) as AnchorId[];

/** Para onde cada ponto "olha" (teste de visibilidade das anotações); null = sempre visível. */
const ANCHOR_NORMALS: Readonly<Record<AnchorId, readonly [number, number, number] | null>> = {
  pony: [0, 0.2, 1],
  polo: [0, 0.2, -1],
  brim: [0, 1, 0.35],
  eyelet: [0.85, 0.5, 0],
  seam: [1, 0.1, 0],
  strap: [0, -0.1, -1],
  button: null,
};

const EL_LIMIT = { min: -0.25, max: 1.05 } as const;
/** Maior extensão do boné na tela (coordenadas normalizadas, 1 = borda da área). */
const FIT_LIMIT = 0.93;
/** Textura no celular: 1024² sobra para a área do boné e sobe 4× mais rápido para a GPU. */
const LOW_TEXTURE_SIZE = 1024;
/** Quantos vértices do modelo entram na conta de enquadramento (amostra uniforme). */
const FIT_SAMPLES = 480;
/** Entrada: espera a abertura da marca sair de cima e então desce girando. */
const ENTRANCE_S = 2.2;
const ENTRANCE_DELAY_S = 0.35;
/** Multiplicador da cor do tecido (atlas já tingido com a mediana medida nas fotos). */
const FABRIC_LEVEL = 0.6;

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
  tilt: 0,
  roll: 0,
  spin: 0,
  lift: 0,
};

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Saída com leve passada do ponto (a aterrissagem do boné). */
function easeOutBack(t: number): number {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class CapStage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  // Teleobjetiva leve, como fotografia de produto (sem exagerar a aba por perspectiva).
  private readonly camera = new PerspectiveCamera(20, 1, 0.05, 120);
  /** Pivô no centro do boné: recebe a pose; o modelo dentro dele fica centralizado. */
  private readonly pivot = new Group();
  private readonly lightRig = new Group();
  private readonly key = new DirectionalLight(0xffffff, 2.2);
  private readonly fill = new DirectionalLight(0xf3f1ee, 0.8);
  private readonly rim = new DirectionalLight(0xffffff, 1.6);
  private readonly hemi = new HemisphereLight(0xffffff, 0xe8e2d8, 0.55);
  private readonly anchors = {} as Record<AnchorId, Vector3>;
  private readonly disposables = new Set<BufferGeometry | Material | Texture>();
  private readonly textures = new Set<Texture>();
  private readonly options: CapStageOptions;
  private readonly high: boolean;

  private width = 1;
  private height = 1;
  private active = false;
  private dirty = true;
  /** Já desenhou um quadro (shaders prontos): redimensionar redesenha na hora, sem quadro vazio. */
  private rendered = false;
  private lastTime = 0;
  /** Extensão horizontal (maior entre largura e profundidade), largura da copa e altura do boné. */
  private frameWidth = 2.8;
  private crownWidth = 2;
  private frameHeight = 1.4;
  private groundY = -0.7;
  /** Raio do boné em torno do pivô (planos de corte da câmera). */
  private radius = 2;
  /** Sombra de contato desenhada (qualidade "low", no lugar do mapa de sombra). */
  private blob: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null;
  private readonly focus = new Vector3();

  private readonly target: Rig = { ...DEFAULT_RIG };
  private readonly current: Rig = { ...DEFAULT_RIG };
  private userAz = 0;
  private userEl = 0;
  private velocityAz = 0;
  private userDecay = false;
  private pointers = new Map<number, Vector2>();
  private lastMoveTime = 0;

  /** Guarda de enquadramento: afasta a câmera se alguma parte do boné fosse sair da área. */
  private fitSamples: Float32Array = new Float32Array(0);
  private fitGoal = 1;
  private fitScale = 1;

  /** Entrada (0 → 1), flutuação contínua e inclinação na direção do cursor. */
  private entrance = 1;
  private clock = 0;
  private readonly hover = { x: 0, y: 0, tx: 0, ty: 0 };

  constructor(options: CapStageOptions) {
    this.options = options;
    const high = options.quality === "high";
    this.high = high;
    // Antisserrilhado sempre: sem ele as bordas "cintilam" enquanto o boné gira (e em GPU de
    // celular o MSAA sai quase de graça).
    this.renderer = new WebGLRenderer({ canvas: options.canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.type = PCFShadowMap;

    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.62;
    this.disposables.add(environment);

    // Estúdio: principal suave do alto/esquerda, preenchimento à direita, recorte por trás.
    this.key.position.set(-2.4, 4.6, 4.2);
    this.key.castShadow = high;
    this.key.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    this.key.shadow.camera.left = -2.6;
    this.key.shadow.camera.right = 2.6;
    this.key.shadow.camera.top = 2.6;
    this.key.shadow.camera.bottom = -2.6;
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 14;
    this.key.shadow.radius = 6;
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.02;
    this.fill.position.set(3.6, 1.2, 3.2);
    this.rim.position.set(0.4, 3.4, -5);
    this.lightRig.add(this.key, this.fill, this.rim, this.key.target);
    this.scene.add(this.lightRig, this.hemi, this.pivot);

    options.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.attachInput(options.canvas);
  }

  /**
   * Monta a cena a partir dos bytes do modelo (já baixados enquanto a abertura tocava) ou,
   * sem eles, baixando agora; troca os materiais por versões de tecido.
   */
  async load(source?: ArrayBuffer): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = source ? await loader.parseAsync(source, "") : await loader.loadAsync(CAP_MODEL_URL);
    const model = gltf.scene;
    const anisotropy = this.high ? 8 : 4;

    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = this.high;
      object.receiveShadow = this.high;
      this.disposables.add(object.geometry as BufferGeometry);
      const source = object.material as MeshStandardMaterial;
      this.disposables.add(source);
      if (source.name === "fabric") {
        // Algodão lavado: sem brilho especular, com "sheen" (o brilho de fibra nas bordas).
        if (source.map) {
          source.map.anisotropy = anisotropy;
          this.disposables.add(source.map);
          this.textures.add(source.map);
        }
        if (source.normalMap) {
          this.disposables.add(source.normalMap);
          this.textures.add(source.normalMap);
        }
        object.material = this.track(
          new MeshPhysicalMaterial({
            map: source.map,
            // Calibrado contra as fotos: sob a luz de estúdio o preto lavado fica no mesmo tom.
            color: new Color(FABRIC_LEVEL, FABRIC_LEVEL, FABRIC_LEVEL),
            normalMap: source.normalMap,
            normalScale: source.normalScale.clone(),
            roughness: 0.95,
            sheen: 0.32,
            sheenColor: new Color("#4a4a4a"),
            sheenRoughness: 0.6,
            side: DoubleSide,
          }),
        );
      } else if (source.name === "strap") {
        object.material = this.track(
          new MeshPhysicalMaterial({ color: source.color.clone(), roughness: 0.82, sheen: 0.5, sheenColor: new Color("#5a5a5a"), side: DoubleSide }),
        );
      }
    });

    // Centraliza no pivô: as rotações da pose giram em torno do meio do boné.
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    model.position.sub(center);
    this.pivot.add(model);
    this.fitSamples = this.sampleVertices(model, center);
    this.frameWidth = Math.max(size.x, size.z);
    this.crownWidth = size.x;
    this.frameHeight = size.y;
    this.groundY = box.min.y - center.y - 0.002;
    this.radius = size.length() / 2;
    for (const id of ANCHOR_IDS) {
      const [x, y, z] = MODEL_ANCHORS[id];
      this.anchors[id] = new Vector3(x, y, z).sub(center);
    }

    if (this.high) {
      const ground = new Mesh(this.track(new PlaneGeometry(14, 14)), this.track(new ShadowMaterial({ opacity: 0.15 })));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = this.groundY;
      ground.receiveShadow = true;
      this.scene.add(ground);
    } else {
      this.blob = this.createContactShadow(size);
      this.scene.add(this.blob);
      await Promise.all([...this.textures].map((texture) => this.shrinkTexture(texture, LOW_TEXTURE_SIZE)));
    }
    this.dirty = true;
  }

  /** Sombra de contato: elipse esfumada no chão, do tamanho da pegada do boné. */
  private createContactShadow(size: Vector3): Mesh<PlaneGeometry, MeshBasicMaterial> {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, "rgba(0,0,0,0.26)");
      gradient.addColorStop(0.45, "rgba(0,0,0,0.15)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const map = this.track(new CanvasTexture(canvas));
    map.colorSpace = SRGBColorSpace;
    const material = this.track(new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    const blob = new Mesh(this.track(new PlaneGeometry(1, 1)), material);
    blob.scale.set(size.x * 1.2, size.z * 1.05, 1);
    blob.position.y = this.groundY;
    blob.renderOrder = -1;
    return blob;
  }

  /** Reduz uma textura fora da thread principal (createImageBitmap) antes de ela ir para a GPU. */
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

  /**
   * Compila os shaders e sobe as texturas para a GPU antes do primeiro quadro visível, para o
   * boné entrar sem engasgo. A página chama isto enquanto nada se move na tela.
   */
  async warmUp(): Promise<void> {
    this.apply();
    await this.renderer.compileAsync(this.scene, this.camera);
    for (const texture of this.textures) this.renderer.initTexture(texture);
    this.draw();
  }

  private draw(): void {
    this.renderer.render(this.scene, this.camera);
    this.rendered = true;
  }

  /** Amostra uniforme de vértices de todas as peças, no espaço do pivô. */
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

  private track<T extends BufferGeometry | Material | Texture>(item: T): T {
    this.disposables.add(item);
    return item;
  }

  /** Posição de repouso (espaço da cena) de uma âncora — usada como ponto de foco da câmera. */
  anchor(id: FocusId): Vector3 {
    return id === "center" ? new Vector3() : (this.anchors[id]?.clone() ?? new Vector3());
  }

  /** O boné desce girando e assenta (chamado quando a apresentação aparece). */
  playEntrance(): void {
    if (this.options.reducedMotion) return;
    // Começa negativo: segura a pose inicial (no alto, girado) enquanto o canvas aparece.
    this.entrance = -ENTRANCE_DELAY_S / ENTRANCE_S;
    this.dirty = true;
  }

  /* ───────────── Entrada (arraste, pinça, teclado, cursor) ───────────── */

  private attachInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("keydown", this.onKeyDown);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    this.velocityAz = 0;
    this.userDecay = false;
    this.lastMoveTime = performance.now();
    this.options.onInteract?.();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) {
      // Só passando o cursor: o boné se inclina de leve na direção dele.
      if (event.pointerType === "mouse" && !this.options.reducedMotion) {
        const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
        this.hover.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.hover.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      }
      return;
    }
    const now = performance.now();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    previous.set(event.clientX, event.clientY);
    if (this.pointers.size > 1) return;
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
    if (this.options.reducedMotion) this.velocityAz = 0;
  };

  private readonly onPointerLeave = (): void => {
    this.hover.tx = 0;
    this.hover.ty = 0;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const step = 0.28;
    if (event.key === "ArrowLeft") this.userAz += step;
    else if (event.key === "ArrowRight") this.userAz -= step;
    else if (event.key === "ArrowUp") this.userEl += step * 0.5;
    else if (event.key === "ArrowDown") this.userEl -= step * 0.5;
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

  /** Define o alvo da câmera/luz/pose. `immediate` pula a suavização (primeiro quadro, movimento reduzido). */
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

  /** Desfaz a rotação manual (volta ao enquadramento da apresentação). */
  resetView(): void {
    this.userAz = 0;
    this.userEl = 0;
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
    // Mudar o tamanho apaga o canvas: redesenha já, antes da pintura (sem um quadro em branco).
    if (this.rendered) {
      this.apply();
      this.draw();
    }
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
    this.fitScale = this.fitGoal;
    this.apply();
    this.draw();
  }

  dispose(): void {
    this.setActive(false);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("keydown", this.onKeyDown);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    for (const item of this.disposables) item.dispose();
    this.key.shadow.map?.dispose();
    this.renderer.dispose();
  }

  /* ───────────── Loop ───────────── */

  private get portrait(): boolean {
    return this.width < this.height;
  }

  /** Distância que enquadra o boné na área do canvas (a guarda cuida do que sobrar). */
  private fitDistance(): number {
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    if (!this.portrait) {
      // Paisagem: o boné inteiro, de qualquer lado, com folga.
      const widthPx = Math.min(this.width * 0.78, (this.height * 0.74 * this.frameWidth) / this.frameHeight);
      return (this.frameWidth * this.height) / (2 * tanHalf * widthPx);
    }
    // Celular (retrato): a largura manda. Enquadra uma largura entre a da copa (vista de frente)
    // e o comprimento com a aba (de lado) quase de borda a borda; quando a pose mostra mais do
    // que isso, a guarda afasta só o necessário.
    const nominal = this.crownWidth + (this.frameWidth - this.crownWidth) * 0.35;
    const widthPx = Math.min(this.width * 0.9, (this.height * 0.8 * nominal) / this.frameHeight);
    return (nominal * this.height) / (2 * tanHalf * widthPx);
  }

  /** No celular os planos abertos afastam só metade: o boné continua grande na tela estreita. */
  private shotDistance(dist: number): number {
    return this.portrait && dist > 1 ? 1 + (dist - 1) * 0.5 : dist;
  }

  /** Pose do pivô (rad; `lift` em unidades do modelo). */
  private pose(lift: number, tilt: number, yaw: number, roll: number): void {
    this.pivot.position.y = lift;
    this.pivot.rotation.set(tilt, yaw, roll, "YXZ");
    this.pivot.updateMatrixWorld();
  }

  /**
   * Planos de corte justos em volta do boné: a profundidade fica precisa até em GPU de celular,
   * sem "z-fighting" entre a copa e o forro (era o que fazia o boné piscar ao girar).
   */
  private fitDepthRange(distance: number, target: Vector3): void {
    const reach = this.radius + target.length() + Math.abs(this.pivot.position.y);
    const near = Math.max(0.05, distance - reach * 1.5);
    const far = distance + reach * 2.5;
    if (Math.abs(near - this.camera.near) < 1e-3 && Math.abs(far - this.camera.far) < 1e-3) return;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
  }

  /** A sombra de contato segue o giro do boné e esmaece quando ele sobe. */
  private placeContactShadow(): void {
    const blob = this.blob;
    if (!blob) return;
    const height = Math.max(0, this.pivot.position.y);
    blob.rotation.set(-Math.PI / 2, 0, this.pivot.rotation.y);
    blob.material.opacity = Math.max(0.15, 1 - height * 0.9);
  }

  private readonly poseQuat = new Quaternion();

  private placeCamera(az: number, el: number, distance: number, target: Vector3): void {
    this.camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * distance,
      target.y + Math.sin(el) * distance,
      target.z + Math.cos(az) * Math.cos(el) * distance,
    );
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }

  private readonly fitPoint = new Vector3();

  /** Maior |x| ou |y| (coordenadas normalizadas da tela) entre os vértices amostrados. */
  private projectedExtent(): number {
    const samples = this.fitSamples;
    const m = this.pivot.matrixWorld;
    let extent = 0;
    for (let i = 0; i < samples.length; i += 3) {
      this.fitPoint.set(samples[i]!, samples[i + 1]!, samples[i + 2]!).applyMatrix4(m).project(this.camera);
      extent = Math.max(extent, Math.abs(this.fitPoint.x), Math.abs(this.fitPoint.y));
    }
    return extent;
  }

  private apply(): void {
    const c = this.current;
    const az = c.az + this.userAz;
    const el = Math.min(EL_LIMIT.max, Math.max(EL_LIMIT.min, c.el + this.userEl));
    const target = this.focus.set(c.tx, c.ty, c.tz);
    this.camera.setViewOffset(this.width, this.height, -c.frameX * this.width * 0.5, c.frameY * this.height * 0.5, this.width, this.height);

    // Pose: coreografia + entrada (desce girando) + flutuação + cursor.
    const motion = this.options.reducedMotion ? 0 : 1;
    const progress = Math.min(1, Math.max(0, this.entrance));
    const drop = 1 - easeOutBack(progress); // descida com leve passada ao assentar
    const turn = Math.pow(1 - progress, 3); // giro desacelerando até parar de frente
    const t = this.clock;
    const floatY = motion * (Math.sin(t * 1.15) * 0.022 + Math.sin(t * 0.53 + 1.3) * 0.01);
    const floatRoll = motion * Math.sin(t * 0.71 + 0.4) * 0.018;
    const floatTilt = motion * Math.sin(t * 0.93 + 2.1) * 0.014;
    const yaw = c.spin - turn * Math.PI * 1.1;
    this.pivot.scale.setScalar(0.86 + 0.14 * Math.min(1, 1 - drop));

    // Câmera no enquadramento da tomada; se alguma parte do boné fosse sair da área, afasta o
    // necessário. A guarda mede a pose da tomada, sem a flutuação nem o cursor (o tamanho não
    // "respira" junto com eles); na entrada o boné vem de cima e ela não persegue a queda.
    const base = this.fitDistance() * this.shotDistance(c.dist);
    if (this.fitSamples.length > 0 && this.entrance >= 1) {
      this.pose(c.lift, c.tilt, yaw, c.roll);
      this.placeCamera(az, el, base, target);
      this.fitGoal = Math.max(1, this.projectedExtent() / FIT_LIMIT);
      if (this.fitScale < 1.0001 && this.fitGoal < 1.0001) this.fitScale = 1;
    }
    this.pose(
      c.lift + floatY + drop * 0.9,
      c.tilt + floatTilt + this.hover.y * 0.07 - drop * 0.35,
      yaw + this.hover.x * 0.12,
      c.roll + floatRoll + turn * 0.18,
    );
    const distance = base * this.fitScale;
    this.placeCamera(az, el, distance, target);
    this.fitDepthRange(distance, target);
    this.placeContactShadow();

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
    // Sem movimento reduzido, o boné respira (flutuação contínua) enquanto está na tela.
    let moving = !this.options.reducedMotion;
    this.clock += dt;

    if (this.entrance < 1) {
      this.entrance = Math.min(1, this.entrance + dt / ENTRANCE_S);
      moving = true;
    }
    this.hover.x = damp(this.hover.x, this.hover.tx, 4, dt);
    this.hover.y = damp(this.hover.y, this.hover.ty, 4, dt);
    if (Math.abs(this.fitScale - this.fitGoal) > 1e-4) {
      this.fitScale = damp(this.fitScale, this.fitGoal, this.fitGoal > this.fitScale ? 16 : 4, dt);
      moving = true;
    }
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
    this.draw();
    this.emitAnchors();
  };

  private readonly scratch = new Vector3();
  private readonly normal = new Vector3();
  private readonly toCamera = new Vector3();

  /** Projeta as âncoras já com a pose atual do boné (as etiquetas acompanham o movimento). */
  private emitAnchors(): void {
    const onFrame = this.options.onFrame;
    if (!onFrame) return;
    this.pivot.updateMatrixWorld();
    this.pivot.getWorldQuaternion(this.poseQuat);
    const out = {} as Record<AnchorId, ProjectedPoint>;
    for (const id of ANCHOR_IDS) {
      const rest = this.anchors[id];
      if (!rest) {
        out[id] = { x: 0, y: 0, visible: false };
        continue;
      }
      this.scratch.copy(rest).applyMatrix4(this.pivot.matrixWorld);
      const n = ANCHOR_NORMALS[id];
      let visible = true;
      if (n) {
        this.normal.set(n[0], n[1], n[2]).normalize().applyQuaternion(this.poseQuat);
        this.toCamera.copy(this.camera.position).sub(this.scratch).normalize();
        visible = this.normal.dot(this.toCamera) > 0.2;
      }
      this.scratch.project(this.camera);
      out[id] = {
        x: (this.scratch.x * 0.5 + 0.5) * this.width,
        y: (-this.scratch.y * 0.5 + 0.5) * this.height,
        visible: visible && this.scratch.z < 1 && Math.abs(this.scratch.x) < 0.96 && Math.abs(this.scratch.y) < 0.96,
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
