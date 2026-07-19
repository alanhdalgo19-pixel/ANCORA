// Siembra los datos de configuración del panel admin: proveedores, catálogo
// de prendas, parámetros singleton (DTF/bordado/serigrafía/impresión
// directa/sublimación), tarifas de serigrafía, tramos de margen, costes
// operativos y precios placeholder de prenda. Uso: npm run seed:admin
//
// Mismo patrón que seed_users.mjs / seed_clientes.mjs: fetch directo contra
// la API REST de Supabase con SUPABASE_SERVICE_ROLE_KEY, sin el SDK
// @supabase/supabase-js (evita el RealtimeClient — CLAUDE.md sección 14).
//
// Nota: `supabase/seed.sql` ya sembró proveedores (con tipo/dias_entrega
// incompletos para Fruit, Clique y Kariban), tecnicas, tipos_picaje y los 5
// "parametros_*" singleton con sus valores por defecto (que ya coinciden con
// los confirmados por Espe). Este script por tanto: (a) completa los campos
// que faltaban en proveedores, (b) es idempotente — no vuelve a insertar lo
// que ya exista, (c) no pisa `costes_operativos` ya presentes (algunos están
// deliberadamente en null, "pendiente Espe") ni los `parametros_*` que ya
// existan con id=1.

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

// ── A.1: Proveedores ─────────────────────────────────────────────────

const PROVEEDORES_OBJETIVO = [
  { nombre: "Roly", tipo: "precio", dias_entrega: 3 },
  { nombre: "JHK", tipo: "urgencia", dias_entrega: 1 },
  { nombre: "Fruit", tipo: "precio", dias_entrega: 3 },
  { nombre: "Clique", tipo: "calidad", dias_entrega: 3 },
  { nombre: "Kariban", tipo: "calidad", dias_entrega: 4 },
];

async function sembrarProveedores() {
  const ids = {};

  for (const objetivo of PROVEEDORES_OBJETIVO) {
    const filas = await fetchJson(
      `${SUPABASE_URL}/rest/v1/proveedores?nombre=eq.${encodeURIComponent(objetivo.nombre)}&select=id,tipo,dias_entrega`,
      { headers: HEADERS },
    );
    const existente = filas[0] ?? null;

    if (existente) {
      ids[objetivo.nombre] = existente.id;
      const desactualizado =
        existente.tipo !== objetivo.tipo ||
        existente.dias_entrega !== objetivo.dias_entrega;

      if (desactualizado) {
        await fetchJson(
          `${SUPABASE_URL}/rest/v1/proveedores?id=eq.${existente.id}`,
          {
            method: "PATCH",
            headers: { ...HEADERS, Prefer: "return=minimal" },
            body: JSON.stringify({
              tipo: objetivo.tipo,
              dias_entrega: objetivo.dias_entrega,
            }),
          },
        );
        console.log(
          `Completado: ${objetivo.nombre} (tipo=${objetivo.tipo}, dias_entrega=${objetivo.dias_entrega})`,
        );
      } else {
        console.log(`Ya existía y coincide: ${objetivo.nombre}`);
      }
      continue;
    }

    const creado = await fetchJson(`${SUPABASE_URL}/rest/v1/proveedores`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({
        nombre: objetivo.nombre,
        tipo: objetivo.tipo,
        dias_entrega: objetivo.dias_entrega,
        activo: true,
      }),
    });
    ids[objetivo.nombre] = creado[0].id;
    console.log(`Creado: ${objetivo.nombre}`);
  }

  return ids;
}

// ── A.11: Catálogo inicial de prendas ────────────────────────────────

const PRENDAS_OBJETIVO = [
  { codigo_interno: "CAM-BEAGLE-ROLY", nombre: "Camiseta manga corta Beagle", modelo: "Beagle", proveedor: "Roly", tejido: "algodon" },
  { codigo_interno: "CAM-TSRA-JHK", nombre: "Camiseta TSRA", modelo: "TSRA", proveedor: "JHK", tejido: "algodon" },
  { codigo_interno: "CAM-CLIQUE", nombre: "Camiseta Clique", modelo: null, proveedor: "Clique", tejido: "algodon" },
  { codigo_interno: "POL-PORA200-JHK", nombre: "Polo Pora200", modelo: "Pora200", proveedor: "JHK", tejido: "mixto" },
  { codigo_interno: "POL-CLASSIC-CLIQUE", nombre: "Polo Classic", modelo: "Classic", proveedor: "Clique", tejido: "algodon" },
  { codigo_interno: "POL-STAR-ROLY", nombre: "Polo Star", modelo: "Star", proveedor: "Roly", tejido: "mixto" },
  { codigo_interno: "SUD-SWRARSHIRT-JHK", nombre: "Sudadera cuello redondo Swrarshirt", modelo: "Swrarshirt", proveedor: "JHK", tejido: "mixto" },
  { codigo_interno: "SUD-CLASSIC-ROLY", nombre: "Sudadera cuello redondo Classic", modelo: "Classic", proveedor: "Roly", tejido: "mixto" },
  { codigo_interno: "SUD-SWRAZIP-JHK", nombre: "Sudadera 1/2 cremallera Swrazip", modelo: "Swrazip", proveedor: "JHK", tejido: "mixto" },
  { codigo_interno: "SUD-KANGAROO-JHK", nombre: "Sudadera capucha Kangaroo", modelo: "Kangaroo", proveedor: "JHK", tejido: "mixto" },
  { codigo_interno: "SUD-URBAN-ROLY", nombre: "Sudadera Urban", modelo: "Urban", proveedor: "Roly", tejido: "mixto" },
  { codigo_interno: "CHQ-ANTARTIDA-ROLY", nombre: "Chaqueta neopreno Antártida", modelo: "Antártida", proveedor: "Roly", tejido: "neopreno" },
  { codigo_interno: "CHQ-CAPUCHA-FRUIT", nombre: "Chaqueta sudadera con capucha", modelo: null, proveedor: "Fruit", tejido: "mixto" },
];

async function sembrarPrendas(proveedorIds) {
  const ids = {};

  for (const objetivo of PRENDAS_OBJETIVO) {
    const filas = await fetchJson(
      `${SUPABASE_URL}/rest/v1/prendas?codigo_interno=eq.${encodeURIComponent(objetivo.codigo_interno)}&select=id`,
      { headers: HEADERS },
    );
    const existente = filas[0] ?? null;

    if (existente) {
      ids[objetivo.codigo_interno] = existente.id;
      console.log(`Ya existía: ${objetivo.codigo_interno}`);
      continue;
    }

    const proveedorId = proveedorIds[objetivo.proveedor];
    if (!proveedorId) {
      console.error(
        `No se encontró el proveedor "${objetivo.proveedor}" para ${objetivo.codigo_interno}, se omite.`,
      );
      continue;
    }

    const creado = await fetchJson(`${SUPABASE_URL}/rest/v1/prendas`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({
        codigo_interno: objetivo.codigo_interno,
        nombre: objetivo.nombre,
        modelo: objetivo.modelo,
        proveedor_id: proveedorId,
        tejido: objetivo.tejido,
        disponible_oscuro: true,
        descripcion: null,
        activo: true,
      }),
    });
    ids[objetivo.codigo_interno] = creado[0].id;
    console.log(`Creada: ${objetivo.codigo_interno}`);
  }

  return ids;
}

// ── A.2–A.7: Parámetros singleton ────────────────────────────────────

const PARAMETROS_SINGLETON = [
  {
    tabla: "parametros_dtf",
    datos: {
      ancho_rollo_cm: 35.0,
      precio_metro: 10.0,
      recorte_por_logo: 0.1,
      mano_obra_por_minuto: 0.32,
      preparacion_pct: 20.0,
      minimo_trabajo: 15.0,
      margen_seguridad_cm: 0.5,
      minutos_setup_fijo: 5,
      minutos_por_logo: 0.1,
    },
  },
  {
    tabla: "parametros_bordado",
    datos: {
      precio_tarifa_1: 0.35,
      precio_tarifa_2: 0.4,
      precio_tarifa_3: 0.45,
      precio_personalizable_default: 0.45,
      unidad_medida: "por_1000_puntadas",
      minimo_pieza: 1.0,
      minimo_trabajo: 15.0,
    },
  },
  {
    tabla: "parametros_serigrafia",
    datos: {
      recargo_oscura_pecho_por_color: 35.0,
      recargo_oscura_espalda_por_color: 37.0,
      fotolito_pecho: 14.0,
      fotolito_espalda: 19.0,
      minimo_trabajo: 20.0,
      pantone_por_color: 25.0,
      vectorizacion: 35.0,
    },
  },
  {
    tabla: "parametros_impresion_directa",
    datos: { usa_tarifa_serigrafia: true, solo_algodon: true, minimo_trabajo: 15.0 },
  },
  {
    tabla: "parametros_sublimacion",
    datos: {
      precio_unitario_base: 0.0,
      cantidad_minima: 1,
      tasa_merma_pct: 0.0,
      solo_blanco_poliester: true,
    },
  },
];

async function sembrarParametrosSingleton() {
  for (const { tabla, datos } of PARAMETROS_SINGLETON) {
    const filas = await fetchJson(
      `${SUPABASE_URL}/rest/v1/${tabla}?id=eq.1&select=id`,
      { headers: HEADERS },
    );

    if (filas.length) {
      console.log(`Ya existía: ${tabla}`);
      continue;
    }

    await fetchJson(`${SUPABASE_URL}/rest/v1/${tabla}`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=minimal" },
      body: JSON.stringify(datos),
    });
    console.log(`Creado: ${tabla}`);
  }
}

// ── A.5: Tarifas de serigrafía (40 filas confirmadas por Espe) ──────

const TARIFAS_SERIGRAFIA = [
  // esporádico — pecho
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 1, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 1.8 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 1, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 1.27 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 1, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 1.15 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 1, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 0.95 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 1, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 0.75 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 2, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 2.1 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 2, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 1.9 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 2, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 1.73 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 2, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 1.41 },
  { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 2, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 1.15 },
  // esporádico — espalda
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 1, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 2.03 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 1, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 1.85 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 1, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 1.71 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 1, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 1.32 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 1, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 1.27 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 2, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 3.05 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 2, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 2.77 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 2, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 2.56 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 2, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 2.0 },
  { tipo_cliente: "esporadico", ubicacion: "espalda", num_colores: 2, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 1.9 },
  // habitual — pecho
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 1, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 1.32 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 1, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 1.21 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 1, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 1.1 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 1, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 0.9 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 1, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 0.72 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 2, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 2.0 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 2, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 1.81 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 2, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 1.65 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 2, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 1.35 },
  { tipo_cliente: "habitual", ubicacion: "pecho", num_colores: 2, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 1.09 },
  // habitual — espalda
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 1, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 1.94 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 1, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 1.76 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 1, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 1.63 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 1, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 1.26 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 1, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 1.21 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 2, desde_cantidad: 1, hasta_cantidad: 50, precio_unitario: 2.9 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 2, desde_cantidad: 51, hasta_cantidad: 100, precio_unitario: 2.64 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 2, desde_cantidad: 101, hasta_cantidad: 150, precio_unitario: 2.44 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 2, desde_cantidad: 151, hasta_cantidad: 200, precio_unitario: 1.9 },
  { tipo_cliente: "habitual", ubicacion: "espalda", num_colores: 2, desde_cantidad: 201, hasta_cantidad: 300, precio_unitario: 1.81 },
];

function claveTarifa(fila) {
  return `${fila.tipo_cliente}|${fila.ubicacion}|${fila.num_colores}|${fila.desde_cantidad}`;
}

async function sembrarTarifasSerigrafia() {
  const existentes = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tarifas_serigrafia?select=tipo_cliente,ubicacion,num_colores,desde_cantidad`,
    { headers: HEADERS },
  );
  const existentesSet = new Set(existentes.map(claveTarifa));
  const faltantes = TARIFAS_SERIGRAFIA.filter((f) => !existentesSet.has(claveTarifa(f)));

  if (!faltantes.length) {
    console.log(`Las ${TARIFAS_SERIGRAFIA.length} tarifas de serigrafía ya existían.`);
    return;
  }

  await fetchJson(`${SUPABASE_URL}/rest/v1/tarifas_serigrafia`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(faltantes),
  });
  console.log(
    `Creadas ${faltantes.length} tarifas de serigrafía (${existentes.length} ya existían).`,
  );
}

// ── A.9: Márgenes por tramo de cantidad (provisionales) ──────────────

const TRAMOS = [
  { desde: 1, hasta: 19 },
  { desde: 20, hasta: 99 },
  { desde: 100, hasta: 499 },
  { desde: 500, hasta: null },
];

const MARGENES_POR_TECNICA = {
  DTF: [60, 50, 40, 30],
  BORDADO: [55, 45, 35, 25],
  SERIGRAFIA: [50, 40, 30, 20],
  IMPRESION_DIRECTA: [55, 45, 35, 25],
  SUBLIMACION: [55, 45, 35, 25],
};

async function sembrarTramosMargen() {
  const tecnicas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tecnicas?select=id,codigo`,
    { headers: HEADERS },
  );
  const tecnicaIdPorCodigo = Object.fromEntries(
    tecnicas.map((t) => [t.codigo, t.id]),
  );

  const filasObjetivo = [];
  for (const [codigo, margenes] of Object.entries(MARGENES_POR_TECNICA)) {
    const tecnicaId = tecnicaIdPorCodigo[codigo];
    if (!tecnicaId) {
      console.error(`No se encontró la técnica ${codigo}, se omite.`);
      continue;
    }
    TRAMOS.forEach((tramo, indice) => {
      for (const tipo_cliente of ["esporadico", "habitual"]) {
        filasObjetivo.push({
          tecnica_id: tecnicaId,
          tipo_cliente,
          desde_cantidad: tramo.desde,
          hasta_cantidad: tramo.hasta,
          margen_pct: margenes[indice],
        });
      }
    });
  }

  const existentes = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tramos_margen?select=tecnica_id,tipo_cliente,desde_cantidad`,
    { headers: HEADERS },
  );
  const clave = (f) => `${f.tecnica_id}|${f.tipo_cliente}|${f.desde_cantidad}`;
  const existentesSet = new Set(existentes.map(clave));
  const faltantes = filasObjetivo.filter((f) => !existentesSet.has(clave(f)));

  if (!faltantes.length) {
    console.log(`Los ${filasObjetivo.length} tramos de margen ya existían.`);
    return;
  }

  await fetchJson(`${SUPABASE_URL}/rest/v1/tramos_margen`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(faltantes),
  });
  console.log(
    `Creados ${faltantes.length} tramos de margen (${existentes.length} ya existían). Recuerda: son provisionales.`,
  );
}

// ── A.8: Tipos de picaje (ya sembrados en el bootstrap) ──────────────

async function verificarTiposPicaje() {
  const filas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/tipos_picaje?select=codigo,precio_base`,
    { headers: HEADERS },
  );
  if (filas.length === 4) {
    console.log("Los 4 tipos de picaje ya estaban sembrados — no se modifican.");
  } else {
    console.log(
      `Aviso: se esperaban 4 tipos_picaje y se encontraron ${filas.length}. Revisar manualmente en el panel admin.`,
    );
  }
}

// ── A.10: Costes operativos ───────────────────────────────────────────

const COSTES_OBJETIVO = [
  { clave: "iva_estandar", valor: 21.0, descripcion: "IVA aplicable a presupuestos (%)" },
  { clave: "transporte_baleares", valor: 0.0, descripcion: "Coste transporte dentro de Baleares (PTE definir)" },
  { clave: "transporte_peninsula", valor: 0.0, descripcion: "Coste transporte a península (PTE definir)" },
  { clave: "electricidad_hora_aprox", valor: 0.0, descripcion: "Coste electricidad estimado por hora de máquina (PTE)" },
  { clave: "descuento_manual_max_pct", valor: 10.0, descripcion: "Descuento máximo que Sonia puede aplicar sin admin" },
  { clave: "umbral_cliente_habitual_eur", valor: 3000.0, descripcion: "Facturación anual mínima para considerar cliente habitual" },
];

async function sembrarCostesOperativos() {
  const existentes = await fetchJson(
    `${SUPABASE_URL}/rest/v1/costes_operativos?select=clave`,
    { headers: HEADERS },
  );
  const clavesExistentes = new Set(existentes.map((f) => f.clave));
  const faltantes = COSTES_OBJETIVO.filter((c) => !clavesExistentes.has(c.clave));

  if (!faltantes.length) {
    console.log("Las 6 claves de costes operativos ya existían.");
    return;
  }

  await fetchJson(`${SUPABASE_URL}/rest/v1/costes_operativos`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(faltantes),
  });
  console.log(
    `Creadas ${faltantes.length} claves nuevas (${existentes.length} ya existían): ${faltantes
      .map((f) => f.clave)
      .join(", ")}`,
  );
}

// ── A.11 (precios): 24 filas placeholder por prenda ──────────────────

const COLOR_GRUPOS = ["blanco", "color", "oscuro"];
const TIPOS_CLIENTE = ["esporadico", "habitual"];

async function sembrarPreciosPrenda(prendaIds) {
  let prendasConPlaceholders = 0;
  let prendasYaConPrecios = 0;

  for (const [codigo, prendaId] of Object.entries(prendaIds)) {
    const existentes = await fetchJson(
      `${SUPABASE_URL}/rest/v1/precios_prenda?prenda_id=eq.${prendaId}&select=id&limit=1`,
      { headers: HEADERS },
    );
    if (existentes.length) {
      prendasYaConPrecios += 1;
      continue;
    }

    const filas = [];
    for (const color_grupo of COLOR_GRUPOS) {
      for (const tipo_cliente of TIPOS_CLIENTE) {
        for (const tramo of TRAMOS) {
          filas.push({
            prenda_id: prendaId,
            color_grupo,
            tipo_cliente,
            desde_cantidad: tramo.desde,
            hasta_cantidad: tramo.hasta,
            precio: 0,
          });
        }
      }
    }

    await fetchJson(`${SUPABASE_URL}/rest/v1/precios_prenda`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "return=minimal" },
      body: JSON.stringify(filas),
    });
    console.log(`Creados ${filas.length} precios placeholder para ${codigo}`);
    prendasConPlaceholders += 1;
  }

  console.log(
    `\n${prendasConPlaceholders} prendas con precios nuevos, ${prendasYaConPrecios} ya tenían precios.`,
  );
}

async function main() {
  console.log("== Proveedores ==");
  const proveedorIds = await sembrarProveedores();

  console.log("\n== Prendas ==");
  const prendaIds = await sembrarPrendas(proveedorIds);

  console.log("\n== Parámetros singleton (DTF/bordado/serigrafía/impresión directa/sublimación) ==");
  await sembrarParametrosSingleton();

  console.log("\n== Tarifas de serigrafía ==");
  await sembrarTarifasSerigrafia();

  console.log("\n== Tramos de margen (provisionales) ==");
  await sembrarTramosMargen();

  console.log("\n== Tipos de picaje ==");
  await verificarTiposPicaje();

  console.log("\n== Costes operativos ==");
  await sembrarCostesOperativos();

  console.log("\n== Precios de prenda (placeholders) ==");
  await sembrarPreciosPrenda(prendaIds);

  console.log("\nListo.");
}

main().catch((error) => {
  console.error("Error inesperado:", error);
  process.exit(1);
});
