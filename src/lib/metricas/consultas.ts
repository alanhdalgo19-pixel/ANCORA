// Consultas del panel de métricas (Prompt 10).
//
// Único módulo de la carpeta que habla con Supabase: `calcularMetricas.ts`
// recibe ya los datos en las formas puras de `tipos.ts` y por eso puede
// probarse sin base de datos (mismo patrón que `src/lib/exportacion/`).
//
// Autorización: se usa el cliente del USUARIO, no `service_role`. Las políticas
// RLS del Prompt 2 dan SELECT sobre `presupuestos`, `lineas_presupuesto`,
// `clientes` y las tablas de configuración a `admin`, `operador` y `consulta`;
// la Server Action ya ha comprobado antes que el rol sea admin u operador.
//
// Todas las agregaciones se hacen en TypeScript después de la consulta, no con
// agregaciones SQL: Ancora hace ~18 presupuestos al mes (~216 al año), así que
// el volumen es trivial y el código queda legible y comprobable.

import type { createClient } from "@/lib/supabase/server";
import type { CodigoTecnica, EstadoPresupuesto } from "@/types/database";
import { sumarDiasISO } from "@/lib/format";
import type { RangoFechas } from "./periodos";
import { hoyEnMadrid } from "./periodos";
import { DIAS_BORRADOR_OLVIDADO, DIAS_SIN_RESPUESTA } from "./umbrales";
import type {
  CandidatoAlerta,
  DatosMetricas,
  EstadoCatalogo,
  LineaMetrica,
  PresupuestoMetrica,
} from "./tipos";

type SupabaseServerClient = ReturnType<typeof createClient>;

/** Nº de filas que devuelve PostgREST por petición (límite por defecto). */
const TAMANO_PAGINA = 1000;

/** Nº de ids por cláusula `in(...)`: PostgREST consulta por GET y la URL crece. */
const TAMANO_LOTE_IDS = 100;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

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
 * Recorre todas las páginas de una consulta. PostgREST corta a 1.000 filas por
 * petición. En el volumen real de Ancora nunca se alcanza, pero un panel que
 * trunca en silencio daría cifras falsas sin avisar, que es peor que tardar.
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
 * El join `clientes(nombre)` devuelve un objeto porque la FK es simple, pero
 * los tipos inferidos de PostgREST lo describen a veces como array; se aceptan
 * las dos formas para no depender de esa inferencia.
 */
function nombreCliente(relacion: unknown): string {
  if (Array.isArray(relacion)) {
    return texto((relacion[0] as { nombre?: unknown } | undefined)?.nombre);
  }
  return texto((relacion as { nombre?: unknown } | null)?.nombre);
}

// ---------------------------------------------------------------------------
// Presupuestos del período
// ---------------------------------------------------------------------------

interface FilaPresupuesto {
  id: string;
  numero: string;
  estado: EstadoPresupuesto;
  fecha_emision: string;
  total: unknown;
  enviado_a_facturacion: string | null;
  cliente_id: string;
  clientes: unknown;
}

const SELECT_PRESUPUESTO =
  "id, numero, estado, fecha_emision, total, enviado_a_facturacion, cliente_id, clientes(nombre)";

export async function cargarPresupuestosPeriodo(
  supabase: SupabaseServerClient,
  { desde, hasta }: RangoFechas,
): Promise<PresupuestoMetrica[]> {
  const filas = await paginar<FilaPresupuesto>((inicio, fin) =>
    supabase
      .from("presupuestos")
      .select(SELECT_PRESUPUESTO)
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta)
      .order("fecha_emision", { ascending: true })
      .range(inicio, fin),
  );

  return filas.map((fila) => ({
    id: fila.id,
    numero: fila.numero,
    estado: fila.estado,
    fecha_emision: fila.fecha_emision,
    total: num(fila.total),
    enviado_a_facturacion: fila.enviado_a_facturacion,
    cliente_id: fila.cliente_id,
    // Por FK NOT NULL no puede faltar, pero el panel no debe pintar filas mudas.
    cliente_nombre: nombreCliente(fila.clientes) || "Cliente sin nombre",
  }));
}

/** Solo el recuento del período anterior: la comparativa no necesita más. */
export async function contarPresupuestos(
  supabase: SupabaseServerClient,
  { desde, hasta }: RangoFechas,
): Promise<number> {
  const { count, error } = await supabase
    .from("presupuestos")
    .select("id", { count: "exact", head: true })
    .gte("fecha_emision", desde)
    .lte("fecha_emision", hasta);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Líneas
// ---------------------------------------------------------------------------

interface FilaLinea {
  id: string;
  presupuesto_id: string;
  tipo_linea: LineaMetrica["tipo_linea"];
  tecnica_id: string | null;
  linea_padre_id: string | null;
  importe_linea: unknown;
}

export async function cargarLineas(
  supabase: SupabaseServerClient,
  presupuestoIds: string[],
): Promise<LineaMetrica[]> {
  if (presupuestoIds.length === 0) return [];

  const lineas: LineaMetrica[] = [];

  for (const lote of trocear(presupuestoIds, TAMANO_LOTE_IDS)) {
    const filas = await paginar<FilaLinea>((inicio, fin) =>
      supabase
        .from("lineas_presupuesto")
        .select(
          "id, presupuesto_id, tipo_linea, tecnica_id, linea_padre_id, importe_linea",
        )
        .in("presupuesto_id", lote)
        .order("orden", { ascending: true })
        .range(inicio, fin),
    );

    for (const fila of filas) {
      lineas.push({
        id: fila.id,
        presupuesto_id: fila.presupuesto_id,
        tipo_linea: fila.tipo_linea,
        tecnica_id: fila.tecnica_id,
        linea_padre_id: fila.linea_padre_id,
        importe_linea: num(fila.importe_linea),
      });
    }
  }

  return lineas;
}

/** `tecnicas.id` → código (`DTF`, `BORDADO`…). */
export async function cargarTecnicas(
  supabase: SupabaseServerClient,
): Promise<Map<string, CodigoTecnica>> {
  const { data, error } = await supabase.from("tecnicas").select("id, codigo");
  if (error) throw new Error(error.message);

  const mapa = new Map<string, CodigoTecnica>();
  for (const fila of data ?? []) {
    mapa.set(fila.id as string, fila.codigo as CodigoTecnica);
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// Candidatos a alerta
// ---------------------------------------------------------------------------

interface FilaCandidato {
  id: string;
  numero: string;
  estado: EstadoPresupuesto;
  fecha_emision: string;
  fecha_validez: string | null;
  created_at: string;
  clientes: unknown;
}

const SELECT_CANDIDATO =
  "id, numero, estado, fecha_emision, fecha_validez, created_at, clientes(nombre)";

function aCandidato(fila: FilaCandidato): CandidatoAlerta {
  return {
    id: fila.id,
    numero: fila.numero,
    estado: fila.estado,
    fecha_emision: fila.fecha_emision,
    fecha_validez: fila.fecha_validez,
    created_at: fila.created_at,
    cliente_nombre: nombreCliente(fila.clientes) || "Cliente sin nombre",
  };
}

/**
 * Presupuestos que pueden acabar en el bloque de alertas.
 *
 * Los enviados sin respuesta y los borradores olvidados NO se limitan al
 * período seleccionado: son avisos operativos ("esto lleva parado demasiado
 * tiempo") y esconderlos por estar mirando el mes en curso sería lo contrario
 * de lo que se busca. Los caducados sí se limitan al período, como pide el
 * enunciado.
 *
 * El corte por antigüedad se aplica aquí como prefiltro, para no traerse el
 * histórico entero, y se vuelve a aplicar en `construirAlertas`, que es donde
 * vive el criterio definitivo y comprobable con tests.
 */
export async function cargarCandidatosAlerta(
  supabase: SupabaseServerClient,
  rango: RangoFechas,
  hoy: string = hoyEnMadrid(),
): Promise<CandidatoAlerta[]> {
  const limiteEnviados = sumarDiasISO(hoy, -DIAS_SIN_RESPUESTA);
  const limiteBorradores = sumarDiasISO(hoy, -DIAS_BORRADOR_OLVIDADO);

  const [enviados, caducados, borradores] = await Promise.all([
    paginar<FilaCandidato>((inicio, fin) =>
      supabase
        .from("presupuestos")
        .select(SELECT_CANDIDATO)
        .eq("estado", "enviado")
        .lte("fecha_emision", limiteEnviados)
        .order("fecha_emision", { ascending: true })
        .range(inicio, fin),
    ),
    paginar<FilaCandidato>((inicio, fin) =>
      supabase
        .from("presupuestos")
        .select(SELECT_CANDIDATO)
        .eq("estado", "caducado")
        .gte("fecha_emision", rango.desde)
        .lte("fecha_emision", rango.hasta)
        .order("fecha_emision", { ascending: false })
        .range(inicio, fin),
    ),
    paginar<FilaCandidato>((inicio, fin) =>
      supabase
        .from("presupuestos")
        .select(SELECT_CANDIDATO)
        .eq("estado", "borrador")
        // `created_at` es timestamptz. El prefiltro se deja holgado (un día de
        // margen) y el corte exacto en días de Madrid lo hace la función pura.
        .lt("created_at", `${sumarDiasISO(limiteBorradores, 1)}T00:00:00Z`)
        .order("created_at", { ascending: true })
        .range(inicio, fin),
    ),
  ]);

  return [...enviados, ...caducados, ...borradores].map(aCandidato);
}

// ---------------------------------------------------------------------------
// Estado del catálogo (no depende del período)
// ---------------------------------------------------------------------------

export async function cargarEstadoCatalogo(
  supabase: SupabaseServerClient,
): Promise<EstadoCatalogo> {
  const [prendas, precios, sublimacion, clientes] = await Promise.all([
    paginar<{ id: string }>((inicio, fin) =>
      supabase.from("prendas").select("id").eq("activo", true).range(inicio, fin),
    ),
    paginar<{ prenda_id: string; precio: unknown }>((inicio, fin) =>
      supabase
        .from("precios_prenda")
        .select("prenda_id, precio")
        .range(inicio, fin),
    ),
    supabase
      .from("parametros_sublimacion")
      .select("precio_unitario_base")
      .eq("id", 1)
      .maybeSingle(),
    paginar<{ cif: string | null; direccion: string | null }>((inicio, fin) =>
      supabase
        .from("clientes")
        .select("cif, direccion")
        .eq("activo", true)
        .range(inicio, fin),
    ),
  ]);

  if (sublimacion.error) throw new Error(sublimacion.error.message);

  // Una prenda "tiene precio" si al menos una de sus filas de `precios_prenda`
  // es mayor que 0. Las que no tienen ninguna fila cuentan también como sin
  // precio: para el wizard son igual de inservibles.
  const mejorPrecio = new Map<string, number>();
  for (const fila of precios) {
    const precio = num(fila.precio);
    const actual = mejorPrecio.get(fila.prenda_id);
    if (actual === undefined || precio > actual) {
      mejorPrecio.set(fila.prenda_id, precio);
    }
  }

  const prendasSinPrecio = prendas.filter(
    (prenda) => (mejorPrecio.get(prenda.id) ?? 0) <= 0,
  ).length;

  // El texto vacío cuenta igual que el null: un CIF en blanco tampoco sirve
  // para facturar.
  const clientesIncompletos = clientes.filter(
    (cliente) => !texto(cliente.cif).trim() || !texto(cliente.direccion).trim(),
  ).length;

  return {
    prendas_sin_precio: prendasSinPrecio,
    sublimacion_sin_tarifa: num(sublimacion.data?.precio_unitario_base) <= 0,
    clientes_sin_datos_fiscales: clientesIncompletos,
  };
}

// ---------------------------------------------------------------------------
// Carga completa
// ---------------------------------------------------------------------------

/** Trae todo lo que necesita `agregarMetricas` para un rango. */
export async function cargarDatosMetricas(
  supabase: SupabaseServerClient,
  rango: RangoFechas,
  rangoPrevio: RangoFechas,
  hoy: string = hoyEnMadrid(),
): Promise<DatosMetricas> {
  const [presupuestos, emitidosPeriodoAnterior, tecnicas, candidatos, catalogo] =
    await Promise.all([
      cargarPresupuestosPeriodo(supabase, rango),
      contarPresupuestos(supabase, rangoPrevio),
      cargarTecnicas(supabase),
      cargarCandidatosAlerta(supabase, rango, hoy),
      cargarEstadoCatalogo(supabase),
    ]);

  const lineas = await cargarLineas(
    supabase,
    presupuestos.map((presupuesto) => presupuesto.id),
  );

  return {
    presupuestos,
    emitidos_periodo_anterior: emitidosPeriodoAnterior,
    lineas,
    tecnicas,
    candidatos_alerta: candidatos,
    catalogo,
  };
}

/** Versión reducida para el widget de `/admin`: solo lo que pide la actividad. */
export async function cargarDatosActividad(
  supabase: SupabaseServerClient,
  rango: RangoFechas,
  rangoPrevio: RangoFechas,
): Promise<{
  presupuestos: PresupuestoMetrica[];
  emitidos_periodo_anterior: number;
}> {
  const [presupuestos, emitidosPeriodoAnterior] = await Promise.all([
    cargarPresupuestosPeriodo(supabase, rango),
    contarPresupuestos(supabase, rangoPrevio),
  ]);

  return { presupuestos, emitidos_periodo_anterior: emitidosPeriodoAnterior };
}
