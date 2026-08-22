// Agregación de las métricas del panel (Prompt 10).
//
// La parte de arriba del archivo es PURA: recibe los datos ya cargados y
// devuelve las cifras. La de abajo es el orquestador que llama a `consultas.ts`
// y encadena ambas. Esta separación es la que permite probar los criterios de
// negocio (ratio de conversión, distribución por técnica, umbrales de alerta)
// sin levantar Supabase, igual que el motor de cálculo de `src/lib/calculos/`.

import type { createClient } from "@/lib/supabase/server";
import { redondear2 } from "@/lib/calculos";
import { fechaEnMadrid } from "@/lib/exportacion/consultas";
import type { CodigoTecnica } from "@/types/database";
import {
  cargarDatosActividad,
  cargarDatosMetricas,
} from "./consultas";
import {
  diasEntre,
  hoyEnMadrid,
  rangoAnterior,
  type RangoFechas,
} from "./periodos";
import {
  DIAS_BORRADOR_OLVIDADO,
  DIAS_SIN_RESPUESTA,
  MAX_ITEMS_ALERTA,
  TOP_CLIENTES,
} from "./umbrales";
import type {
  Actividad,
  Alertas,
  CandidatoAlerta,
  DatosMetricas,
  DistribucionTecnica,
  LineaMetrica,
  Metricas,
  PresupuestoAlerta,
  PresupuestoMetrica,
  TopClientes,
} from "./tipos";

type SupabaseServerClient = ReturnType<typeof createClient>;

/** Orden fijo de las técnicas en toda la pantalla. */
export const CODIGOS_TECNICA: CodigoTecnica[] = [
  "DTF",
  "BORDADO",
  "SERIGRAFIA",
  "IMPRESION_DIRECTA",
  "SUBLIMACION",
];

function contadorPorTecnica(): Record<CodigoTecnica, number> {
  return {
    DTF: 0,
    BORDADO: 0,
    SERIGRAFIA: 0,
    IMPRESION_DIRECTA: 0,
    SUBLIMACION: 0,
  };
}

// ---------------------------------------------------------------------------
// Bloque 1 — Actividad
// ---------------------------------------------------------------------------

/**
 * Estados que cuentan como "resueltos" a efectos del ratio de conversión: el
 * cliente ya ha dado (o dejado de dar) una respuesta. Los borradores y los
 * enviados siguen vivos y no deben penalizar la conversión.
 */
const ESTADOS_RESUELTOS = ["aceptado", "rechazado", "caducado"] as const;

export function calcularActividad(
  presupuestos: PresupuestoMetrica[],
  emitidosPeriodoAnterior: number,
): Actividad {
  const aceptados = presupuestos.filter(
    (presupuesto) => presupuesto.estado === "aceptado",
  );

  // "En cotización" = dinero que aún está en juego: lo enviado a la espera de
  // respuesta más lo ya aceptado que todavía no se ha volcado a facturación.
  const enCotizacion = presupuestos
    .filter(
      (presupuesto) =>
        (presupuesto.estado === "enviado" || presupuesto.estado === "aceptado") &&
        presupuesto.enviado_a_facturacion === null,
    )
    .reduce((suma, presupuesto) => suma + presupuesto.total, 0);

  const totalAceptado = aceptados.reduce(
    (suma, presupuesto) => suma + presupuesto.total,
    0,
  );

  const resueltos = presupuestos.filter((presupuesto) =>
    (ESTADOS_RESUELTOS as readonly string[]).includes(presupuesto.estado),
  ).length;

  return {
    emitidos: presupuestos.length,
    emitidos_periodo_anterior: emitidosPeriodoAnterior,
    variacion_emitidos_pct:
      emitidosPeriodoAnterior === 0
        ? null
        : redondear2(
            ((presupuestos.length - emitidosPeriodoAnterior) /
              emitidosPeriodoAnterior) *
              100,
          ),
    en_cotizacion: redondear2(enCotizacion),
    total_aceptado: redondear2(totalAceptado),
    ratio_conversion:
      resueltos === 0 ? null : redondear2((aceptados.length / resueltos) * 100),
  };
}

// ---------------------------------------------------------------------------
// Bloque 2 — Top clientes
// ---------------------------------------------------------------------------

export function calcularTopClientes(
  presupuestos: PresupuestoMetrica[],
): TopClientes {
  const volumen = new Map<string, { nombre: string; total: number }>();
  const cantidad = new Map<string, { nombre: string; num: number }>();

  for (const presupuesto of presupuestos) {
    // Volumen facturado: solo los aceptados, que es el dinero que entra.
    if (presupuesto.estado === "aceptado") {
      const acumulado = volumen.get(presupuesto.cliente_id);
      volumen.set(presupuesto.cliente_id, {
        nombre: presupuesto.cliente_nombre,
        total: (acumulado?.total ?? 0) + presupuesto.total,
      });
    }

    // Nº de presupuestos: todos los estados, mide el trabajo que da el cliente.
    const contados = cantidad.get(presupuesto.cliente_id);
    cantidad.set(presupuesto.cliente_id, {
      nombre: presupuesto.cliente_nombre,
      num: (contados?.num ?? 0) + 1,
    });
  }

  const porVolumen = Array.from(volumen.entries())
    .map(([cliente_id, datos]) => ({
      cliente_id,
      nombre: datos.nombre,
      total: redondear2(datos.total),
    }))
    .filter((cliente) => cliente.total > 0)
    // Empate a importe: por nombre, para que el orden sea estable entre cargas.
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, TOP_CLIENTES);

  const porCantidad = Array.from(cantidad.entries())
    .map(([cliente_id, datos]) => ({
      cliente_id,
      nombre: datos.nombre,
      num_presupuestos: datos.num,
    }))
    .sort(
      (a, b) =>
        b.num_presupuestos - a.num_presupuestos ||
        a.nombre.localeCompare(b.nombre, "es"),
    )
    .slice(0, TOP_CLIENTES);

  return { por_volumen: porVolumen, por_cantidad: porCantidad };
}

// ---------------------------------------------------------------------------
// Bloque 3 — Distribución por técnica
// ---------------------------------------------------------------------------

/**
 * Reparte las líneas por técnica.
 *
 * - Recuento: una vez por presupuesto y técnica. Un presupuesto con dos líneas
 *   DTF y una de bordado suma 1 a DTF y 1 a bordado, no 2 y 1: la pregunta que
 *   responde el bloque es "en cuántos presupuestos aparece cada técnica".
 * - Importe: solo de presupuestos ACEPTADOS, porque la cifra se presenta como
 *   facturación y un rechazado grande falsearía el reparto. Los extras (picaje,
 *   fotolitos, vectorización, pantones) se atribuyen a la técnica de su línea
 *   padre; si no tuvieran padre, a la suya propia.
 * - Las líneas de tipo `prenda` quedan fuera: venden ropa, no personalización.
 */
export function calcularDistribucionTecnica(
  presupuestos: PresupuestoMetrica[],
  lineas: LineaMetrica[],
  tecnicas: Map<string, CodigoTecnica>,
): DistribucionTecnica {
  const estadoPorPresupuesto = new Map(
    presupuestos.map((presupuesto) => [presupuesto.id, presupuesto.estado]),
  );
  const tecnicaPorLinea = new Map(lineas.map((linea) => [linea.id, linea]));

  /** Código de técnica al que se imputa una línea, o null si no le toca ninguno. */
  function codigoDe(linea: LineaMetrica): CodigoTecnica | null {
    if (linea.tipo_linea === "prenda") return null;

    const propia = linea.tecnica_id ? tecnicas.get(linea.tecnica_id) : undefined;
    if (linea.tipo_linea === "tecnica") return propia ?? null;

    const padre = linea.linea_padre_id
      ? tecnicaPorLinea.get(linea.linea_padre_id)
      : undefined;
    const heredada =
      padre?.tecnica_id != null ? tecnicas.get(padre.tecnica_id) : undefined;

    return heredada ?? propia ?? null;
  }

  const porNumPresupuestos = contadorPorTecnica();
  const porFacturacion = contadorPorTecnica();
  const vistos = new Set<string>();
  const presupuestosConTecnica = new Set<string>();

  for (const linea of lineas) {
    const codigo = codigoDe(linea);
    if (!codigo) continue;

    const estado = estadoPorPresupuesto.get(linea.presupuesto_id);
    if (estado === undefined) continue;

    // Solo las líneas de técnica marcan presencia; un extra siempre cuelga de
    // una y contarlo otra vez no cambiaría nada, pero deja el criterio explícito.
    if (linea.tipo_linea === "tecnica") {
      const clave = `${linea.presupuesto_id}:${codigo}`;
      if (!vistos.has(clave)) {
        vistos.add(clave);
        porNumPresupuestos[codigo] += 1;
      }
      presupuestosConTecnica.add(linea.presupuesto_id);
    }

    if (estado === "aceptado") {
      porFacturacion[codigo] += linea.importe_linea;
    }
  }

  for (const codigo of CODIGOS_TECNICA) {
    porFacturacion[codigo] = redondear2(porFacturacion[codigo]);
  }

  return {
    por_num_presupuestos: porNumPresupuestos,
    por_facturacion: porFacturacion,
    total_presupuestos_con_tecnica: presupuestosConTecnica.size,
  };
}

// ---------------------------------------------------------------------------
// Bloque 4 — Alertas
// ---------------------------------------------------------------------------

function alerta(
  candidato: CandidatoAlerta,
  fecha: string,
  dias: number,
): PresupuestoAlerta {
  return {
    id: candidato.id,
    numero: candidato.numero,
    cliente: candidato.cliente_nombre,
    dias,
    fecha,
  };
}

/**
 * Aplica los umbrales de antigüedad sobre los candidatos que trajo la consulta.
 *
 * `hoy` entra como parámetro (día natural de Madrid) en vez de leerse de
 * `new Date()` para que los tests puedan fijarlo.
 */
export function construirAlertas(
  candidatos: CandidatoAlerta[],
  hoy: string,
): Alertas {
  const sinRespuesta: PresupuestoAlerta[] = [];
  const caducados: PresupuestoAlerta[] = [];
  const borradores: PresupuestoAlerta[] = [];

  for (const candidato of candidatos) {
    if (candidato.estado === "enviado") {
      const dias = diasEntre(candidato.fecha_emision, hoy);
      if (dias > DIAS_SIN_RESPUESTA) {
        sinRespuesta.push(alerta(candidato, candidato.fecha_emision, dias));
      }
      continue;
    }

    if (candidato.estado === "caducado") {
      // La fecha que le interesa a Sonia es la de caducidad; si faltara, la de
      // emisión es el respaldo razonable.
      const fecha = candidato.fecha_validez ?? candidato.fecha_emision;
      caducados.push(alerta(candidato, fecha, diasEntre(fecha, hoy)));
      continue;
    }

    if (candidato.estado === "borrador") {
      // El esquema no tiene `updated_at`, así que la antigüedad se mide desde
      // la creación (ver decisión del Prompt 10 en CLAUDE.md sección 14).
      const fecha = fechaEnMadrid(candidato.created_at) ?? candidato.fecha_emision;
      const dias = diasEntre(fecha, hoy);
      if (dias > DIAS_BORRADOR_OLVIDADO) {
        borradores.push(alerta(candidato, fecha, dias));
      }
    }
  }

  // Lo más antiguo primero: es lo que más urge revisar.
  const porAntiguedad = (a: PresupuestoAlerta, b: PresupuestoAlerta) =>
    b.dias - a.dias || a.numero.localeCompare(b.numero, "es");

  return {
    sin_respuesta: sinRespuesta.sort(porAntiguedad).slice(0, MAX_ITEMS_ALERTA),
    caducados: caducados.sort(porAntiguedad).slice(0, MAX_ITEMS_ALERTA),
    borradores_olvidados: borradores
      .sort(porAntiguedad)
      .slice(0, MAX_ITEMS_ALERTA),
  };
}

// ---------------------------------------------------------------------------
// Agregación completa (pura)
// ---------------------------------------------------------------------------

export function agregarMetricas(
  datos: DatosMetricas,
  rango: RangoFechas,
  hoy: string,
): Metricas {
  return {
    rango,
    actividad: calcularActividad(
      datos.presupuestos,
      datos.emitidos_periodo_anterior,
    ),
    top_clientes: calcularTopClientes(datos.presupuestos),
    distribucion_tecnica: calcularDistribucionTecnica(
      datos.presupuestos,
      datos.lineas,
      datos.tecnicas,
    ),
    alertas: construirAlertas(datos.candidatos_alerta, hoy),
    catalogo: datos.catalogo,
  };
}

// ---------------------------------------------------------------------------
// Orquestador (con Supabase)
// ---------------------------------------------------------------------------

/** Métricas completas de un rango. La autorización la hace la Server Action. */
export async function calcularMetricas(
  supabase: SupabaseServerClient,
  rango: RangoFechas,
  ahora: Date = new Date(),
): Promise<Metricas> {
  const hoy = hoyEnMadrid(ahora);
  const previo = rangoAnterior(rango);
  const datos = await cargarDatosMetricas(supabase, rango, previo, hoy);
  return agregarMetricas(datos, rango, hoy);
}

/** Solo el bloque de actividad: es lo único que pinta el widget de `/admin`. */
export async function calcularActividadDelRango(
  supabase: SupabaseServerClient,
  rango: RangoFechas,
): Promise<Actividad> {
  const datos = await cargarDatosActividad(supabase, rango, rangoAnterior(rango));
  return calcularActividad(datos.presupuestos, datos.emitidos_periodo_anterior);
}
