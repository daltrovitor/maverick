// Hello World
/**
 * Gera o modelo 3D do boné principal no Meshy AI a partir das fotos reais.
 *
 * Requer MESHY_API_KEY (plano pago do Meshy; contas gratuitas não criam chaves de API).
 *   node scripts/meshy-image-to-3d.mjs brand-assets/source/cap-red-sox-b-front.png public/models/red-sox-b/meshy.glb
 *   node scripts/meshy-image-to-3d.mjs --dry-run <foto> <saida.glb>   # mostra a requisição sem chamar a API
 *
 * Fluxo: POST /openapi/v1/image-to-3d (imagem em data URI) → consulta GET /:id até SUCCEEDED →
 * baixa model_urls.glb. O arquivo só deve substituir o modelo procedural depois de comparado
 * visualmente com as fotos (ver docs/MODELO-3D.md).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname } from "node:path";

const API = "https://api.meshy.ai/openapi/v1/image-to-3d";
const args = process.argv.slice(2);
const dryRun = args[0] === "--dry-run";
const [input, output] = dryRun ? args.slice(1) : args;

if (!input || !output) {
  console.error("uso: node scripts/meshy-image-to-3d.mjs [--dry-run] <foto.png|jpg> <saida.glb>");
  process.exit(1);
}

const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }[extname(input).toLowerCase()];
if (!mime) {
  console.error("A foto precisa ser PNG ou JPG.");
  process.exit(1);
}

const image = await readFile(input);
const body = {
  image_url: `data:${mime};base64,${image.toString("base64")}`,
  ai_model: "latest",
  should_texture: true,
  enable_pbr: true,
  should_remesh: true,
  topology: "triangle",
  target_polycount: 60000,
  // Orienta a textura das partes não visíveis para uma construção convencional, sem logos extras.
  texture_prompt:
    "Black washed cotton twill six-panel dad cap, curved brim with tonal grey stitching, plain back with adjustable fabric strap and metal slider, no extra logos or text on sides or back.",
};

if (dryRun) {
  console.log(JSON.stringify({ ...body, image_url: `${body.image_url.slice(0, 48)}… (${image.length} bytes)` }, null, 2));
  process.exit(0);
}

const key = process.env.MESHY_API_KEY;
if (!key) {
  console.error("Defina MESHY_API_KEY (Meshy → Settings → API). Nenhuma chamada foi feita.");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const created = await fetch(API, { method: "POST", headers, body: JSON.stringify(body) });
if (!created.ok) {
  console.error(`Falha ao criar a tarefa (${created.status}):`, await created.text());
  process.exit(1);
}
const { result: taskId } = await created.json();
console.log("Tarefa criada:", taskId);

let task;
for (;;) {
  await new Promise((r) => setTimeout(r, 10_000));
  const res = await fetch(`${API}/${taskId}`, { headers });
  task = await res.json();
  console.log(`status: ${task.status} ${task.progress ?? ""}%`);
  if (["SUCCEEDED", "FAILED", "CANCELED"].includes(task.status)) break;
}

if (task.status !== "SUCCEEDED" || !task.model_urls?.glb) {
  console.error("A geração não terminou com sucesso:", task.task_error ?? task.status);
  process.exit(1);
}

const glb = await fetch(task.model_urls.glb);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, Buffer.from(await glb.arrayBuffer()));
console.log("Modelo salvo em", output, "— compare com as fotos antes de usar no site.");
