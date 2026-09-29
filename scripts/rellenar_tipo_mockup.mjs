// F2.3 — rellena `prendas.tipo_mockup` a partir del nombre de cada prenda.
//
// Requiere haber aplicado antes la migración
// `supabase/migrations/20260924000000_prendas_tipo_mockup.sql`.
//
// Regla (por palabra clave en el nombre, sin distinguir mayúsculas ni tildes):
//   Polo → polo · Camiseta / T-shirt → camiseta · Sudadera / Hoodie → sudadera
//   Chaleco / Vest → chaleco · Delantal / Apron → delantal
//   Toalla / Towel → toalla · resto → otro
//
// Idempotente: solo toca las prendas con `tipo_mockup` a null. Si Espe ya ha
// corregido un tipo desde Admin → Prendas, este script no lo pisa.
//
// Uso: node scripts/rellenar_tipo_mockup.mjs
//
// Mismo patrón que patch_margenes.mjs: fetch directo contra la API REST de
// Supabase con SUPABASE_SERVICE_ROLE_KEY, sin el SDK (CLAUDE.md sección 14).

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

// El orden importa: "Chaqueta sudadera con capucha" debe caer en sudadera,
// y ninguna palabra de una regla anterior aparece en los nombres de otra.
const REGLAS = [
  { tipo: "polo", palabras: ["polo"] },
  { tipo: "camiseta", palabras: ["camiseta", "t-shirt"] },
  { tipo: "sudadera", palabras: ["sudadera", "hoodie"] },
  { tipo: "chaleco", palabras: ["chaleco", "vest"] },
  { tipo: "delantal", palabras: ["delantal", "apron"] },
  { tipo: "toalla", palabras: ["toalla", "towel"] },
];

/** "Chaqueta neopreno Antártida" → "chaqueta neopreno antartida". */
function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function tipoDeNombre(nombre) {
  const normalizado = normalizar(nombre);
  // Por palabra completa: "vest" no debe casar con "investigación".
  const palabrasNombre = normalizado.split(/[^a-z0-9-]+/);
  for (const regla of REGLAS) {
    if (regla.palabras.some((palabra) => palabrasNombre.includes(palabra))) {
      return regla.tipo;
    }
  }
  return "otro";
}

async function fetchJson(url, options) {
  const respuesta = await fetch(url, options);
  const texto = await respuesta.text();
  const cuerpo = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    const mensaje = cuerpo?.message || cuerpo?.hint || texto;
    throw new Error(`${respuesta.status} ${respuesta.statusText}: ${mensaje}`);
  }
  return cuerpo;
}

async function rellenar() {
  let pendientes;
  try {
    pendientes = await fetchJson(
      `${SUPABASE_URL}/rest/v1/prendas?tipo_mockup=is.null&select=id,nombre&order=nombre`,
      { headers: HEADERS },
    );
  } catch (error) {
    if (/tipo_mockup/.test(error.message)) {
      throw new Error(
        "La columna prendas.tipo_mockup no existe. Aplica primero la migración 20260924000000_prendas_tipo_mockup.sql en el SQL Editor de Supabase.",
      );
    }
    throw error;
  }

  if (!pendientes.length) {
    console.log("Todas las prendas ya tienen tipo de mockup. Nada que hacer.");
    return;
  }

  for (const prenda of pendientes) {
    const tipo = tipoDeNombre(prenda.nombre);
    // `tipo_mockup=is.null` también en el PATCH: si alguien lo ha rellenado
    // entre la lectura y la escritura, no se pisa.
    await fetchJson(
      `${SUPABASE_URL}/rest/v1/prendas?id=eq.${prenda.id}&tipo_mockup=is.null`,
      {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ tipo_mockup: tipo }),
      },
    );
    console.log(`  ${prenda.nombre} → ${tipo}`);
  }

  console.log(`\nAsignado tipo de mockup a ${pendientes.length} prendas.`);
}

async function verificar() {
  const filas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/prendas?select=tipo_mockup`,
    { headers: HEADERS },
  );

  const resumen = {};
  for (const fila of filas) {
    const clave = fila.tipo_mockup ?? "(sin tipo)";
    resumen[clave] = (resumen[clave] ?? 0) + 1;
  }

  console.log("\nEstado final de prendas.tipo_mockup:");
  for (const [tipo, total] of Object.entries(resumen)) {
    console.log(`  ${tipo}: ${total}`);
  }
}

async function main() {
  await rellenar();
  await verificar();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
