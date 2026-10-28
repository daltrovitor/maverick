// Hello World
/**
 * Pintura do boné neutro (modelo "Baseball Cap" de Scott VanArsdale, CC BY 4.0, gerado por
 * scripts/build-polo-model.py --blank) com o que foi lido da foto do produto: tecido por peça na
 * cor da copa/aba e o logo projetado na frente da copa, como um decalque. Compartilhada pela vista
 * 3D da página de produto e pela parede da coleção da página inicial (um conjunto de materiais por
 * boné; texturas do atlas e geometria são divididas entre as cópias).
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from "three";
import type { Rgb } from "@/components/cap/productCapLook";
import type { CapLookTextures } from "@/components/cap/productCapTexture";

export const CAP_BLANK_MODEL_URL = "/models/cap-blank/cap.glb";

/** Atlas neutro gravado com 0,8 (sRGB) na mediana do tecido → 0,6038 em linear. */
export const ATLAS_LEVEL = 0.6038;
/** Cor da foto → albedo: a foto já traz a luz do estúdio; o render acrescenta a dele. */
export const COLOR_GAIN = 0.78;
/** Alto da copa (espaço normalizado do modelo; ver capModelAnchors.ts). */
export const CROWN_TOP = 1.378;

const DECAL_FORWARD = new Vector3(0, -Math.sin((8 * Math.PI) / 180), -Math.cos((8 * Math.PI) / 180));
const DECAL_RIGHT = new Vector3(1, 0, 0);
const DECAL_UP = new Vector3().crossVectors(DECAL_RIGHT, DECAL_FORWARD).normalize();

export function linearColor([r, g, b]: Rgb, gain: number): Color {
  // Color.setRGB em sRGB converte para o espaço linear de trabalho do three.js.
  const color = new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
  return color.multiplyScalar(gain / ATLAS_LEVEL);
}

interface DecalUniforms {
  decalMap: { value: Texture | null };
  decalEnabled: { value: number };
  decalCenter: { value: Vector3 };
  decalSize: { value: Vector2 };
  decalGain: { value: number };
}

/** Materiais de um boné e o decalque da frente dele. */
export interface CapPaint {
  crown: MeshPhysicalMaterial | null;
  brim: MeshPhysicalMaterial | null;
  lining: MeshPhysicalMaterial | null;
  strap: MeshPhysicalMaterial | null;
  decalTexture: CanvasTexture | null;
  readonly decal: DecalUniforms;
}

type Track = <T extends Material>(item: T) => T;

/** Decalque projetado na frente da copa (ortográfico, só na face voltada para a frente). */
function installDecal(material: MeshPhysicalMaterial, uniforms: DecalUniforms): void {
  material.customProgramCacheKey = () => "product-cap-decal";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, {
      decalRight: { value: DECAL_RIGHT },
      decalUp: { value: DECAL_UP },
      decalForward: { value: DECAL_FORWARD },
      decalAtlasLevel: { value: ATLAS_LEVEL },
    });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vDecalPos;\nvarying vec3 vDecalNormal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDecalPos = position;\nvDecalNormal = objectNormal;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D decalMap;
uniform float decalEnabled;
uniform vec3 decalCenter;
uniform vec2 decalSize;
uniform float decalGain;
uniform vec3 decalRight;
uniform vec3 decalUp;
uniform vec3 decalForward;
uniform float decalAtlasLevel;
varying vec3 vDecalPos;
varying vec3 vDecalNormal;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
if (decalEnabled > 0.5 && gl_FrontFacing) {
  vec3 decalRel = vDecalPos - decalCenter;
  vec2 decalUv = vec2(dot(decalRel, decalRight) / decalSize.x + 0.5, dot(decalRel, decalUp) / decalSize.y + 0.5);
  float decalFacing = dot(normalize(vDecalNormal), -decalForward);
  if (decalFacing > 0.2 && abs(dot(decalRel, decalForward)) < 0.6 && all(greaterThanEqual(decalUv, vec2(0.0))) && all(lessThanEqual(decalUv, vec2(1.0)))) {
    vec4 decalColor = texture2D(decalMap, decalUv);
    #ifdef USE_MAP
      float decalShade = sampledDiffuseColor.g / decalAtlasLevel;
    #else
      float decalShade = 1.0;
    #endif
    diffuseColor.rgb = mix(diffuseColor.rgb, decalColor.rgb * decalGain * decalAtlasLevel * decalShade, decalColor.a * smoothstep(0.2, 0.35, decalFacing));
  }
}`,
      );
  };
}

/**
 * Troca os materiais originais do modelo (ou de uma cópia dele) pelos de tecido deste boné.
 * Os materiais novos passam por `track` para serem liberados com a cena.
 */
export function dressCap(model: Object3D, track: Track): CapPaint {
  const paint: CapPaint = {
    crown: null,
    brim: null,
    lining: null,
    strap: null,
    decalTexture: null,
    decal: {
      decalMap: { value: null },
      decalEnabled: { value: 0 },
      decalCenter: { value: new Vector3(0, 0.76, 0.86) },
      decalSize: { value: new Vector2(0.6, 0.5) },
      decalGain: { value: COLOR_GAIN / ATLAS_LEVEL },
    },
  };
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const source = object.material as MeshStandardMaterial;
    const fabric = () =>
      track(
        new MeshPhysicalMaterial({
          map: source.map,
          normalMap: source.normalMap,
          normalScale: source.normalScale.clone(),
          roughness: 0.95,
          sheen: 0.35,
          sheenRoughness: 0.6,
          side: DoubleSide,
        }),
      );
    switch (source.name) {
      case "crown":
        // Copa e botão do topo dividem o material (e o decalque).
        if (!paint.crown) {
          paint.crown = fabric();
          installDecal(paint.crown, paint.decal);
        }
        object.material = paint.crown;
        break;
      case "brim":
        paint.brim ??= fabric();
        object.material = paint.brim;
        break;
      case "lining":
        paint.lining ??= fabric();
        object.material = paint.lining;
        break;
      case "strap":
        paint.strap ??= track(new MeshPhysicalMaterial({ roughness: 0.85, sheen: 0.4, side: DoubleSide }));
        object.material = paint.strap;
        break;
      default:
        break;
    }
  });
  return paint;
}

/** Aplica as cores e o logo lidos da foto (null = boné neutro, cinza claro). */
export function paintCap(paint: CapPaint, look: CapLookTextures | null): void {
  const crown: Rgb = look?.crown ?? [196, 192, 186];
  const brim: Rgb = look?.brim ?? crown;
  paint.crown?.color.copy(linearColor(crown, COLOR_GAIN));
  paint.brim?.color.copy(linearColor(brim, COLOR_GAIN));
  // Forro e tira: o tom da copa, um pouco mais escuros (sombra natural de dentro).
  paint.lining?.color.copy(linearColor(crown, COLOR_GAIN * 0.8));
  paint.strap?.color.copy(linearColor(crown, COLOR_GAIN * 0.85).multiplyScalar(ATLAS_LEVEL));
  for (const material of [paint.crown, paint.brim, paint.lining, paint.strap]) {
    if (!material) continue;
    // Brilho de fibra nas bordas, no tom do próprio tecido.
    material.sheenColor.copy(material.color).multiplyScalar(ATLAS_LEVEL).lerp(new Color(0.5, 0.5, 0.5), 0.35);
  }

  paint.decalTexture?.dispose();
  paint.decalTexture = null;
  const decal = look?.decal;
  if (decal) {
    const texture = new CanvasTexture(decal.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 8;
    paint.decalTexture = texture;
    // Largura do logo pela proporção da foto (copa com largura 2 no modelo), com limites
    // para nunca invadir a aba nem passar do alto da copa.
    let width = Math.min(1.3, Math.max(0.3, decal.widthRatio * 2.05));
    let height = width / decal.aspect;
    if (height > 0.78) {
      width *= 0.78 / height;
      height = 0.78;
    }
    // Na foto o logo fica perto do meio da frente; no modelo, o meio dos painéis da frente
    // fica em ~52% da altura da copa (a base dela some atrás da aba).
    let y = CROWN_TOP * (0.38 + 0.32 * decal.rise);
    y = Math.max(0.3 + height / 2, Math.min(1.2 - height / 2, y));
    // O shader projeta no espaço do próprio modelo (atributo position), sem o deslocamento do pivô.
    paint.decal.decalCenter.value.set(0, y, 0.86);
    paint.decal.decalSize.value.set(width, height);
  }
  paint.decal.decalMap.value = paint.decalTexture;
  paint.decal.decalEnabled.value = paint.decalTexture ? 1 : 0;
}
