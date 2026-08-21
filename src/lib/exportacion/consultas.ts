// Consultas de la exportación a Excel (Prompt 9).
//
// Único módulo de la carpeta que habla con Supabase: los tres formateadores y
// `generarExcel.ts` reciben ya los datos en las formas puras que se declaran
// aquí, para poder probarse sin base de datos (mismo patrón que el motor de
// cálculo de `src/lib/calculos/`).
//
// Autorización: se usa el cliente del USUARIO, no `service_role`. Las políticas
// RLS del Prompt 2 dan a `admin` acceso total a `presupuestos`,
// `lineas_presupuesto`, `clientes` y `usuarios`, y la Server Action ya
// comprueba el rol antes de llegar aquí.

import type { createClient } from "@/lib/supabase/server";
import { redondear2 } from "@/lib/calculos";
import type { EstadoPresupuesto, TipoLinea } from "@/types/database";

type SupabaseServerClient = ReturnType<typeof createClient>;

/** Campo de fecha por el que se filtra el rango. */
export type CampoFecha = "fecha_emision" | "accepted_at";

export interface FiltroExportacion {
  /** `YYYY-MM-DD`, inclusive. */
  desde: string;
  /** `YYYY-MM-DD`, inclusive. */
  hasta: string;
  campo_fecha: CampoFecha;
}

/**
 * Tope de presupuestos por exportación. Por encima se pide confirmación
 * explícita en la pantalla: el .xlsx se genera dentro de una función
 * serverless y un volumen mayor puede agotar su tiempo de ejecución.
 */
export const LIMITE_PRESUPUESTOS_EXPORTACION = 5000;

/** Nº de filas que devuelve PostgREST por petición (límite por defecto). */
const TAMANO_PAGINA = 1000;

/** Nº de ids por cláusula `in(...)`: PostgREST consulta por GET y la URL crece. */
const TAMANO_LOTE_IDS = 100;

export interface RecuentoExportacion {
  total_aceptados: number;
  /** borrador + enviado + rechazado + caducado. */
  total_otros: number;
  total: number;
  /** Aceptados del rango que ya se exportaron alguna vez a facturación. */
  ya_facturados: number;
}

/** Datos fiscales del cliente, ya normalizados a string (nunca null). */
export interface ClienteExport {
  nombre: string;
  cif: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
  email: string;
  telefono: string;
}

export interface PresupuestoExport {
  id: string;
  numero: string;
  estado: EstadoPresupuesto;
  /** `YYYY-MM-DD`. */
  fecha_emision: string;
  /** `YYYY-MM-DD` en hora de Madrid, o null si nunca se aceptó. */
  fecha_aceptacion: string | null;
  /** `YYYY-MM-DD` en hora de Madrid de la última exportación, o null. */
  fecha_enviado_a_facturacion: string | null;
  cliente: ClienteExport;
  subtotal: number;
  descuento_pct: number;
  /** Derivado: `subtotal × descuento_pct / 100`. No se guarda en la tabla. */
  descuento_importe: number;
  transporte: number;
  base_imponible: number;
  iva_pct: number;
  iva_importe: number;
  total: number;
  /** Nombre del usuario que lo creó. */
  emisor: string;
  notas: string;
}

export interface LineaExport {
  numero_presupuesto: string;
  estado: EstadoPresupuesto;
  cliente: string;
  tipo_linea: TipoLinea;
  /** Vacío en líneas de tipo 'extra' y 'prenda' (Prompt 9, apartado G.3). */
  tecnica: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  importe_linea: number;
  es_composicion_dtf: boolean;
  /** Solo para ordenar; no se vuelca al Excel. */
  orden: number;
}

export interface DatosExportacion {
  filtro: FiltroExportacion;
  /** Todos los estados del rango. */
  presupuestos: PresupuestoExport[];
  /** Solo líneas de presupuestos aceptados. */
  lineas: LineaExport[];
}

// ---------------------------------------------------------------------------
// Fechas y zona horaria
// ---------------------------------------------------------------------------
//
// `fecha_emision` es una columna `date` sin hora: el filtro es una comparación
// de texto y no tiene ambigüedad. `accepted_at` es `timestamptz`, así que hay
// que decidir dónde empieza y acaba cada día. Ancora factura en España, de modo
// que "del 1 al 31 de julio" significa del 1 de julio a las 00:00 de Madrid al
// 31 de julio a las 23:59:59 de Madrid, no en UTC. Sin esta conversión, un
// presupuesto aceptado a la 01:00 del 1 de agosto (23:00 UTC del 31 de julio)
// se colaría en la exportación de julio.

const ZONA_ANCORA = "Europe/Madrid";

// "sv-SE" formatea como `2026-07-15 12:30:00`, que es ISO sin la T.
const FORMATO_ZONA = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA_ANCORA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Minutos de desfase de Madrid respecto a UTC en un instante dado (+60/+120). */
function desfaseMadrid(instante: Date): number {
  const enMadrid = new Date(
    `${FORMATO_ZONA.format(instante).replace(" ", "T")}Z`,
  );
  return (enMadrid.getTime() - instante.getTime()) / 60000;
}

/**
 * Instante UTC que corresponde a una hora de pared de Madrid.
 * Se itera dos veces porque el desfase depende del propio instante (verano vs
 * invierno) y la primera aproximación puede caer al otro lado del cambio.
 */
function instanteMadrid(fechaHoraLocal: string): Date {
  const comoUTC = new Date(`${fechaHoraLocal}Z`).getTime();
  let instante = new Date(comoUTC - desfaseMadrid(new Date(comoUTC)) * 60000);
  instante = new Date(comoUTC - desfaseMadrid(instante) * 60000);
  return instante;
}

/** `2026-07-31T23:30:00Z` → `2026-08-01` (día natural en Madrid). */
export function fechaEnMadrid(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  return FORMATO_ZONA.format(instante).slice(0, 10);
}

/** Extremos en ISO-UTC de un rango de días naturales de Madrid, inclusive. */
export function limitesRango(
  desde: string,
  hasta: string,
): { inicio: string; fin: string } {
  return {
    inicio: instanteMadrid(`${desde}T00:00:00`).toISOString(),
    fin: instanteMadrid(`${hasta}T23:59:59.999`).toISOString(),
  };
}

/**
 * Rango por defecto de la pantalla: el mes natural anterior completo.
 *
 * Es el ciclo con el que trabaja una asesoría: en agosto se vuelca julio. Se
 * calcula en hora de Madrid para que el día 1 a primera hora no proponga aún el
 * mes de dos atrás.
 */
export function rangoMesAnterior(hoy: Date = new Date()): {
  desde: string;
  hasta: string;
} {
  const [anio, mes] = FORMATO_ZONA.format(hoy)
    .slice(0, 7)
    .split("-")
    .map(Number);

  const anioAnterior = mes === 1 ? anio - 1 : anio;
  const mesAnterior = mes === 1 ? 12 : mes - 1;

  // Día 0 del mes siguiente = último día del mes anterior (28/29/30/31).
  const ultimoDia = new Date(Date.UTC(anioAnterior, mesAnterior, 0)).getUTCDate();
  const mesTexto = String(mesAnterior).padStart(2, "0");

  return {
    desde: `${anioAnterior}-${mesTexto}-01`,
    hasta: `${anioAnterior}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Null y undefined se vuelcan como celda vacía, no como el texto "null". */
function texto(valor: unknown): string {
  return valor == null ? "" : String(valor);
}

function trocear<T>(elementos: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < elementos.length; i += tamano) {
    lotes.push(elementos.slice(i, i + tamano));
  }
  return lotes;
}

interface RespuestaFilas<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Recorre todas las páginas de una consulta. PostgREST devuelve como mucho
 * 1.000 filas por petición: sin esto, una exportación grande se truncaría en
 * silencio, que es justo lo que no puede pasar en un volcado de facturación.
 */
async function paginar<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<RespuestaFilas<T>>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; ; pagina += 1) {
    const inicio = pagina * TAMANO_PAGINA;
    const { data, error } = await consultar(inicio, inicio + TAMANO_PAGINA - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    filas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }
  return filas;
}

/**
 * Consulta de PostgREST vista como encadenamiento de filtros. El cliente de
 * Supabase tipa cada filtro con el esquema completo, y aquí solo interesa poder
 * añadir condiciones sobre dos columnas conocidas.
 */
interface ConsultaFiltrable {
  eq(columna: string, valor: string): ConsultaFiltrable;
  gte(columna: string, valor: string): ConsultaFiltrable;
  lte(columna: string, valor: string): ConsultaFiltrable;
  not(columna: string, operador: string, valor: null): ConsultaFiltrable;
}

/**
 * Aplica el rango de fechas elegido a una consulta ya construida, devolviendo
 * el mismo tipo de constructor para poder seguir encadenando `.order()`,
 * `.range()` o filtros propios.
 */
function aplicarRango<T>(
  consulta: T,
  { desde, hasta, campo_fecha }: FiltroExportacion,
): T {
  const filtrable = consulta as unknown as ConsultaFiltrable;

  if (campo_fecha === "fecha_emision") {
    return filtrable
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta) as unknown as T;
  }

  const { inicio, fin } = limitesRango(desde, hasta);
  // `accepted_at` es null en todo lo que nunca se aceptó; el rango ya los
  // descarta, pero se deja explícito para que la intención se lea.
  return filtrable
    .not("accepted_at", "is", null)
    .gte("accepted_at", inicio)
    .lte("accepted_at", fin) as unknown as T;
}

// ---------------------------------------------------------------------------
// Recuento (preview de la pantalla)
// ---------------------------------------------------------------------------

interface RespuestaRecuento {
  count: number | null;
  error: { message: string } | null;
}

export async function contarExportacion(
  supabase: SupabaseServerClient,
  filtro: FiltroExportacion,
): Promise<RecuentoExportacion> {
  function contar(
    afinar?: (consulta: ConsultaFiltrable) => ConsultaFiltrable,
  ): PromiseLike<RespuestaRecuento> {
    const base = aplicarRango(
      supabase.from("presupuestos").select("id", { count: "exact", head: true }),
      filtro,
    ) as unknown as ConsultaFiltrable;
    const consulta = afinar ? afinar(base) : base;
    return consulta as unknown as PromiseLike<RespuestaRecuento>;
  }

  const [todos, aceptados, yaFacturados] = await Promise.all([
    contar(),
    contar((consulta) => consulta.eq("estado", "aceptado")),
    contar((consulta) =>
      consulta
        .eq("estado", "aceptado")
        .not("enviado_a_facturacion", "is", null),
    ),
  ]);

  for (const resultado of [todos, aceptados, yaFacturados]) {
    if (resultado.error) throw new Error(resultado.error.message);
  }

  const total = todos.count ?? 0;
  const totalAceptados = aceptados.count ?? 0;

  return {
    total,
    total_aceptados: totalAceptados,
    total_otros: total - totalAceptados,
    ya_facturados: yaFacturados.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------

// Por diseño no puede ocurrir (`cliente_id` es NOT NULL con FK), pero un Excel
// de facturación no debe quedarse con celdas mudas si ocurriera.
const CLIENTE_ELIMINADO: ClienteExport = {
  nombre: "Cliente eliminado",
  cif: "",
  direccion: "",
  localidad: "",
  provincia: "",
  codigo_postal: "",
  email: "",
  telefono: "",
};

interface FilaPresupuesto {
  id: string;
  numero: string;
  estado: EstadoPresupuesto;
  fecha_emision: string;
  accepted_at: string | null;
  enviado_a_facturacion: string | null;
  cliente_id: string;
  usuario_id: string;
  subtotal: unknown;
  descuento_manual_pct: unknown;
  transporte: unknown;
  base_imponible: unknown;
  iva_pct: unknown;
  iva_importe: unknown;
  total: unknown;
  notas: string | null;
}

export async function cargarDatosExportacion(
  supabase: SupabaseServerClient,
  filtro: FiltroExportacion,
): Promise<DatosExportacion> {
  const filas = await paginar<FilaPresupuesto>((inicio, fin) =>
    aplicarRango(
      supabase
        .from("presupuestos")
        .select(
          "id, numero, estado, fecha_emision, accepted_at, enviado_a_facturacion, cliente_id, usuario_id, subtotal, descuento_manual_pct, transporte, base_imponible, iva_pct, iva_importe, total, notas",
        ),
      filtro,
    )
      .order("numero", { ascending: true })
      .range(inicio, fin),
  );

  const [clientes, usuarios] = await Promise.all([
    cargarClientes(
      supabase,
      filas.map((fila) => fila.cliente_id),
    ),
    cargarUsuarios(
      supabase,
      filas.map((fila) => fila.usuario_id),
    ),
  ]);

  const presupuestos: PresupuestoExport[] = filas.map((fila) => {
    const subtotal = num(fila.subtotal);
    const descuentoPct = num(fila.descuento_manual_pct);

    return {
      id: fila.id,
      numero: fila.numero,
      estado: fila.estado,
      fecha_emision: fila.fecha_emision,
      fecha_aceptacion: fechaEnMadrid(fila.accepted_at),
      fecha_enviado_a_facturacion: fechaEnMadrid(fila.enviado_a_facturacion),
      cliente: clientes.get(fila.cliente_id) ?? CLIENTE_ELIMINADO,
      subtotal,
      descuento_pct: descuentoPct,
      descuento_importe: redondear2((subtotal * descuentoPct) / 100),
      transporte: num(fila.transporte),
      base_imponible: num(fila.base_imponible),
      iva_pct: num(fila.iva_pct),
      iva_importe: num(fila.iva_importe),
      total: num(fila.total),
      emisor: usuarios.get(fila.usuario_id) ?? "Usuario dado de baja",
      notas: texto(fila.notas),
    };
  });

  const aceptados = presupuestos.filter(
    (presupuesto) => presupuesto.estado === "aceptado",
  );
  const lineas = await cargarLineas(supabase, aceptados);

  return { filtro, presupuestos, lineas };
}

async function cargarClientes(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<Map<string, ClienteExport>> {
  const mapa = new Map<string, ClienteExport>();
  const unicos = Array.from(new Set(ids));

  for (const lote of trocear(unicos, TAMANO_LOTE_IDS)) {
    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, nombre, cif, direccion, localidad, provincia, codigo_postal, email, telefono",
      )
      .in("id", lote);
    if (error) throw new Error(error.message);

    for (const fila of data ?? []) {
      mapa.set(fila.id as string, {
        nombre: texto(fila.nombre),
        cif: texto(fila.cif),
        direccion: texto(fila.direccion),
        localidad: texto(fila.localidad),
        provincia: texto(fila.provincia),
        codigo_postal: texto(fila.codigo_postal),
        email: texto(fila.email),
        telefono: texto(fila.telefono),
      });
    }
  }

  return mapa;
}

async function cargarUsuarios(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = Array.from(new Set(ids));

  for (const lote of trocear(unicos, TAMANO_LOTE_IDS)) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre")
      .in("id", lote);
    if (error) throw new Error(error.message);

    for (const fila of data ?? []) {
      mapa.set(fila.id as string, texto(fila.nombre));
    }
  }

  return mapa;
}

interface FilaLinea {
  presupuesto_id: string;
  orden: unknown;
  tipo_linea: TipoLinea;
  tecnica_id: string | null;
  descripcion: string;
  cantidad: unknown;
  precio_unitario: unknown;
  importe_linea: unknown;
  detalle_calculo: unknown;
}

/** `true` si el snapshot lo generó el bin packing multi-logo del Prompt 5. */
export function esComposicionDTF(detalle: unknown): boolean {
  return (
    typeof detalle === "object" &&
    detalle !== null &&
    (detalle as { tecnica?: unknown }).tecnica === "DTF_COMPOSICION"
  );
}

async function cargarLineas(
  supabase: SupabaseServerClient,
  aceptados: PresupuestoExport[],
): Promise<LineaExport[]> {
  if (aceptados.length === 0) return [];

  const porId = new Map(aceptados.map((presupuesto) => [presupuesto.id, presupuesto]));
  const tecnicas = await cargarTecnicas(supabase);
  const lineas: LineaExport[] = [];

  for (const lote of trocear(Array.from(porId.keys()), TAMANO_LOTE_IDS)) {
    const filas = await paginar<FilaLinea>((inicio, fin) =>
      supabase
        .from("lineas_presupuesto")
        .select(
          "presupuesto_id, orden, tipo_linea, tecnica_id, descripcion, cantidad, precio_unitario, importe_linea, detalle_calculo",
        )
        .in("presupuesto_id", lote)
        .order("orden", { ascending: true })
        .range(inicio, fin),
    );

    for (const fila of filas) {
      const presupuesto = porId.get(fila.presupuesto_id);
      if (!presupuesto) continue;

      lineas.push({
        numero_presupuesto: presupuesto.numero,
        estado: presupuesto.estado,
        cliente: presupuesto.cliente.nombre,
        tipo_linea: fila.tipo_linea,
        // Los extras (picaje, fotolitos, vectorización) guardan la técnica que
        // los originó, pero en el Excel la columna queda vacía: describen un
        // servicio puntual, no una personalización sobre prenda.
        tecnica:
          fila.tipo_linea === "tecnica" && fila.tecnica_id
            ? tecnicas.get(fila.tecnica_id) ?? ""
            : "",
        descripcion: texto(fila.descripcion),
        cantidad: num(fila.cantidad),
        precio_unitario: num(fila.precio_unitario),
        importe_linea: num(fila.importe_linea),
        es_composicion_dtf: esComposicionDTF(fila.detalle_calculo),
        orden: num(fila.orden),
      });
    }
  }

  return lineas;
}

async function cargarTecnicas(
  supabase: SupabaseServerClient,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("tecnicas")
    .select("id, codigo, nombre");
  if (error) throw new Error(error.message);

  const mapa = new Map<string, string>();
  for (const fila of data ?? []) {
    // Se prefiere el nombre legible de la tabla; el código es el respaldo.
    mapa.set(fila.id as string, texto(fila.nombre) || texto(fila.codigo));
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Marcado del flag de facturación
// ---------------------------------------------------------------------------

/**
 * Presupuestos que se marcan como volcados a facturación: SOLO los aceptados,
 * que son los que salen en la pestaña "Facturables". Borradores, enviados,
 * rechazados y caducados aparecen únicamente en la pestaña de análisis y no se
 * tocan (Prompt 9, "Flag solo en aceptados").
 */
export function idsAFacturar(presupuestos: PresupuestoExport[]): string[] {
  return presupuestos
    .filter((presupuesto) => presupuesto.estado === "aceptado")
    .map((presupuesto) => presupuesto.id);
}

/**
 * Marca los presupuestos aceptados como volcados a facturación.
 *
 * Es un ÚNICO `update ... where id in (...)` por lote, de modo que cada
 * sentencia es atómica en Postgres. Se ejecuta DESPUÉS de generar el .xlsx: si
 * la generación falla, no se marca nada (Prompt 9, "transacción atómica").
 */
export async function marcarEnviadosAFacturacion(
  supabase: SupabaseServerClient,
  ids: string[],
  momento: string,
): Promise<void> {
  for (const lote of trocear(ids, TAMANO_LOTE_IDS)) {
    const { error } = await supabase
      .from("presupuestos")
      .update({ enviado_a_facturacion: momento })
      .in("id", lote);
    if (error) throw new Error(error.message);
  }
}
