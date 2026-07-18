// Siembra los clientes reales extraídos de los presupuestos históricos de
// Ancora. Idempotente: comprueba por CIF (o por nombre si no hay CIF) antes
// de insertar. Uso: npm run seed:clientes
//
// Mismo patrón que seed_users.mjs: fetch directo contra la API REST de
// Supabase con SUPABASE_SERVICE_ROLE_KEY, sin el SDK @supabase/supabase-js
// (evita el RealtimeClient, que en Node 20 sin el paquete "ws" aborta el
// script — CLAUDE.md sección 14, decisión 3).

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

async function buscarClienteExistente({ nombre, cif }) {
  const filtro = cif
    ? `cif=eq.${encodeURIComponent(cif)}`
    : `nombre=eq.${encodeURIComponent(nombre)}`;
  const filas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/clientes?${filtro}&select=id`,
    { headers: HEADERS },
  );
  return filas[0] ?? null;
}

async function crearCliente(datos) {
  await fetchJson(`${SUPABASE_URL}/rest/v1/clientes`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(datos),
  });
}

const CLIENTES_INICIALES = [
  {
    nombre: "Forn Can Pistola S.L.",
    cif: "B44928018",
    telefono: "651402100",
    localidad: "Lloseta",
    provincia: "Illes Balears",
    tipo_cliente: "esporadico",
    descuento_bordado_pct: 0,
  },
  {
    nombre: "The Horse Shop S.L.",
    cif: "B57940769",
    telefono: "670853646",
    localidad: "Manacor",
    provincia: "Illes Balears",
    tipo_cliente: "esporadico",
    descuento_bordado_pct: 0,
  },
  {
    nombre: "Colla Castellers de Mallorca",
    cif: "G07819196",
    telefono: "630522359",
    persona_contacto: "Andreu",
    localidad: "Palma",
    provincia: "Illes Balears",
    tipo_cliente: "habitual",
    descuento_bordado_pct: 10,
  },
  {
    nombre: "Doyle Náutica S.L.",
    cif: "B12345678",
    localidad: "Palma",
    provincia: "Illes Balears",
    tipo_cliente: "habitual",
    descuento_bordado_pct: 15,
  },
  {
    nombre: "Barceló Hoteles",
    cif: "A07000000",
    localidad: "Palma",
    provincia: "Illes Balears",
    tipo_cliente: "habitual",
    descuento_bordado_pct: 12,
  },
];

async function main() {
  let creados = 0;
  let existentes = 0;

  for (const definicion of CLIENTES_INICIALES) {
    const existente = await buscarClienteExistente(definicion);

    if (existente) {
      console.log(`Ya existía: ${definicion.nombre}`);
      existentes += 1;
      continue;
    }

    // Descuento de bordado solo tiene sentido para clientes habituales.
    const datos = {
      ...definicion,
      descuento_bordado_pct:
        definicion.tipo_cliente === "habitual"
          ? definicion.descuento_bordado_pct
          : 0,
    };

    try {
      await crearCliente(datos);
    } catch (error) {
      console.error(`Error insertando "${definicion.nombre}": ${error.message}`);
      continue;
    }

    console.log(`Creado: ${definicion.nombre} (${definicion.tipo_cliente})`);
    creados += 1;
  }

  console.log(`\n${creados} creados, ${existentes} ya existían.`);
}

main().catch((error) => {
  console.error("Error inesperado:", error);
  process.exit(1);
});
