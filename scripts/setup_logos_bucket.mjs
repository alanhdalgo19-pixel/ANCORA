// F2.1 — crea el bucket `logos-clientes` de Supabase Storage.
//
// Uso: npm run setup:logos
//
// Idempotente: si el bucket ya existe comprueba su configuración y la corrige
// (privado, 5 MB, PNG/JPG/SVG/PDF) en vez de fallar.
//
// Mismo patrón que `setup_storage_bucket.mjs` (Prompt 7): fetch directo contra
// la API de Supabase con SUPABASE_SERVICE_ROLE_KEY, sin el SDK
// @supabase/supabase-js (evita el RealtimeClient — CLAUDE.md sección 14,
// decisión 3 del Prompt 1).
//
// Las políticas RLS del bucket van en la migración
// supabase/migrations/20260901000000_logos_clientes.sql, que se aplica a mano
// desde el SQL Editor: la API REST no ejecuta DDL.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", ".env.local");

function cargarEnvLocal(rutaArchivo) {
  if (!existsSync(rutaArchivo)) return;
  const contenido = readFileSync(rutaArchivo, "utf-8");
  for (const linea of contenido.split("\n")) {
    const coincidencia = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!coincidencia) continue;
    const [, clave, valorBruto] = coincidencia;
    if (!(clave in process.env)) {
      process.env[clave] = valorBruto.trim();
    }
  }
}

cargarEnvLocal(ENV_PATH);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const BUCKET = "logos-clientes";

// 5 MB es el máximo que valida también la aplicación
// (`TAMANO_MAX_BYTES` en src/lib/logos/validar.ts). Los dos límites tienen que
// moverse juntos si algún día se sube el tope.
const CONFIGURACION = {
  public: false,
  file_size_limit: 5 * 1024 * 1024,
  allowed_mime_types: [
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "application/pdf",
  ],
};

async function fetchJson(url, options) {
  const respuesta = await fetch(url, options);
  const texto = await respuesta.text();
  const cuerpo = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    const mensaje = cuerpo?.message || cuerpo?.error || texto;
    throw new Error(`${respuesta.status} ${respuesta.statusText}: ${mensaje}`);
  }
  return cuerpo;
}

async function buscarBucket() {
  const buckets = await fetchJson(`${SUPABASE_URL}/storage/v1/bucket`, {
    headers: HEADERS,
  });
  return buckets.find((bucket) => bucket.id === BUCKET) ?? null;
}

async function main() {
  const existente = await buscarBucket();

  if (!existente) {
    await fetchJson(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ id: BUCKET, name: BUCKET, ...CONFIGURACION }),
    });
    console.log(`Bucket "${BUCKET}" creado (privado, 5 MB, PNG/JPG/SVG/PDF).`);
  } else {
    await fetchJson(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify(CONFIGURACION),
    });
    console.log(`Bucket "${BUCKET}" ya existía; configuración actualizada.`);
  }

  const final = await buscarBucket();
  console.log("\nEstado final:");
  console.log(`  público:        ${final.public}`);
  console.log(`  límite tamaño:  ${final.file_size_limit} bytes`);
  console.log(`  tipos MIME:     ${(final.allowed_mime_types ?? []).join(", ")}`);
  console.log(
    "\nRecuerda aplicar supabase/migrations/20260901000000_logos_clientes.sql\n" +
      "desde el SQL Editor de Supabase (tabla logos_clientes + políticas del bucket).",
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
