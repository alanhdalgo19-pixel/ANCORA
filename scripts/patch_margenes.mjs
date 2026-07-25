// Patch 4A — pone a 0% los tramos de margen de BORDADO, SERIGRAFIA,
// IMPRESION_DIRECTA y SUBLIMACION. DTF NO se toca: conserva 60/50/40/30.
//
// Razón (CLAUDE.md sección 13.4): los tests con presupuestos históricos del
// Prompt 4 revelaron que las tarifas de bordado y serigrafía ya son precios
// de venta, no costes internos. Aplicarles el margen provisional del sector
// inflaba los precios un 30-40% respecto a lo que Ancora cobra en realidad.
// Solo DTF construye un coste real (material + mano de obra + preparación),
// así que solo DTF conserva margen por defecto.
//
// Uso: npm run patch:margenes
//
// Mismo patrón que seed_users.mjs / seed_clientes.mjs / seed_admin_data.mjs:
// fetch directo contra la API REST de Supabase con SUPABASE_SERVICE_ROLE_KEY,
// sin el SDK @supabase/supabase-js (evita el RealtimeClient — CLAUDE.md
// sección 14). Idempotente: si ya están a 0 no hace nada.

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

// Técnicas cuyas tarifas ya son precio de venta — margen a 0%.
const TECNICAS_A_CERO = [
  "BORDADO",
  "SERIGRAFIA",
  "IMPRESION_DIRECTA",
  "SUBLIMACION",
];

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

async function ponerMargenesACero() {
  const tecnicas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tecnicas?select=id,codigo`,
    { headers: HEADERS },
  );
  const tecnicaIdPorCodigo = Object.fromEntries(
    tecnicas.map((t) => [t.codigo, t.id]),
  );

  const idsObjetivo = [];
  for (const codigo of TECNICAS_A_CERO) {
    const id = tecnicaIdPorCodigo[codigo];
    if (!id) {
      console.error(`No se encontró la técnica ${codigo}, se omite.`);
      continue;
    }
    idsObjetivo.push(id);
  }

  if (!idsObjetivo.length) {
    console.error("Ninguna de las técnicas objetivo existe. Nada que hacer.");
    return;
  }

  const filtroTecnicas = `tecnica_id=in.(${idsObjetivo.join(",")})`;

  // Solo tocamos las filas que no estén ya a 0 — así el script es idempotente
  // y el recuento del log refleja el cambio real.
  const pendientes = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tramos_margen?${filtroTecnicas}&margen_pct=neq.0&select=id`,
    { headers: HEADERS },
  );

  if (!pendientes.length) {
    console.log(
      "Todos los tramos de bordado/serigrafía/impresión directa/sublimación ya estaban a 0%.",
    );
    return;
  }

  const actualizadas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tramos_margen?${filtroTecnicas}&margen_pct=neq.0`,
    {
      method: "PATCH",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({ margen_pct: 0 }),
    },
  );

  console.log(`Puestos a 0% ${actualizadas.length} tramos de margen.`);
}

async function verificar() {
  const filas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tramos_margen?select=margen_pct,desde_cantidad,tipo_cliente,tecnicas(codigo)&order=desde_cantidad`,
    { headers: HEADERS },
  );

  const resumen = {};
  for (const fila of filas) {
    const codigo = fila.tecnicas?.codigo ?? "?";
    resumen[codigo] ??= new Set();
    resumen[codigo].add(fila.margen_pct);
  }

  console.log("\nEstado final de tramos_margen:");
  for (const [codigo, valores] of Object.entries(resumen)) {
    console.log(`  ${codigo}: ${[...valores].join(" / ")} %`);
  }
}

async function main() {
  await ponerMargenesACero();
  await verificar();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
