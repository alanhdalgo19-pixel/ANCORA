// Tipos del panel de métricas (Prompt 10).
//
// Se separan de `database.ts` porque no son filas de tabla: son la forma
// agregada que consume la pantalla. La frontera es deliberada — `consultas.ts`
// devuelve los "datos crudos" (las tres primeras interfaces) y
// `calcularMetricas.ts` los convierte en `Metricas` con una función pura, que
// es lo que se puede probar sin Supabase.

import type {
  CodigoTecnica,
  EstadoPresupuesto,
  TipoLinea,
} from "@/types/database";
import type { RangoFechas } from "./periodos";

// ---------------------------------------------------------------------------
// Datos crudos (salida de `consultas.ts`)
// ---------------------------------------------------------------------------

export interface PresupuestoMetrica {
  id: string;
  numero: string;
  estado: EstadoPresupuesto;
  /** `YYYY-MM-DD`. */
  fecha_emision: string;
  total: number;
  /** ISO del último volcado a facturación, o null si nunca se exportó. */
  enviado_a_facturacion: string | null;
  cliente_id: string;
  cliente_nombre: string;
}

export interface LineaMetrica {
  id: string;
  presupuesto_id: string;
  tipo_linea: TipoLinea;
  tecnica_id: string | null;
  /** Solo en extras: la línea de técnica que los originó. */
  linea_padre_id: string | null;
  importe_linea: number;
}

/**
 * Presupuesto candidato a aparecer en el bloque de alertas. Se traen de la base
 * de datos por estado y el corte por antigüedad se hace en TypeScript, para que
 * el criterio sea puro y comprobable con tests.
 */
export interface CandidatoAlerta {
  id: string;
  numero: string;
  cliente_nombre: string;
  estado: EstadoPresupuesto;
  /** `YYYY-MM-DD`. */
  fecha_emision: string;
  /** `YYYY-MM-DD`; fecha a partir de la cual el presupuesto caduca. */
  fecha_validez: string | null;
  /** ISO de creación. Sustituye a `updated_at`, que no existe en el esquema. */
  created_at: string;
}

export interface EstadoCatalogo {
  prendas_sin_precio: number;
  sublimacion_sin_tarifa: boolean;
  clientes_sin_datos_fiscales: number;
}

/** Todo lo que la función pura necesita para agregar las métricas. */
export interface DatosMetricas {
  /** Presupuestos del período, todos los estados. */
  presupuestos: PresupuestoMetrica[];
  /** Nº de presupuestos del período anterior equivalente (para la comparativa). */
  emitidos_periodo_anterior: number;
  /** Líneas de los presupuestos del período. */
  lineas: LineaMetrica[];
  /** `tecnicas.id` → código de técnica. */
  tecnicas: Map<string, CodigoTecnica>;
  candidatos_alerta: CandidatoAlerta[];
  catalogo: EstadoCatalogo;
}

// ---------------------------------------------------------------------------
// Métricas agregadas (salida de `calcularMetricas.ts`)
// ---------------------------------------------------------------------------

export interface Actividad {
  emitidos: number;
  emitidos_periodo_anterior: number;
  /** Variación porcentual frente al período anterior; null si aquel fue 0. */
  variacion_emitidos_pct: number | null;
  /** € de enviados + aceptados aún no volcados a facturación. */
  en_cotizacion: number;
  /** € de los aceptados del período. */
  total_aceptado: number;
  /** % de aceptados sobre presupuestos ya resueltos; null si no hay ninguno. */
  ratio_conversion: number | null;
}

export interface ClientePorVolumen {
  cliente_id: string;
  nombre: string;
  total: number;
}

export interface ClientePorCantidad {
  cliente_id: string;
  nombre: string;
  num_presupuestos: number;
}

export interface TopClientes {
  por_volumen: ClientePorVolumen[];
  por_cantidad: ClientePorCantidad[];
}

export interface DistribucionTecnica {
  /** Nº de presupuestos que incluyen la técnica (una vez por presupuesto). */
  por_num_presupuestos: Record<CodigoTecnica, number>;
  /** € de líneas de esa técnica en presupuestos ACEPTADOS (extras incluidos). */
  por_facturacion: Record<CodigoTecnica, number>;
  /** Denominador de los porcentajes: presupuestos del período con alguna técnica. */
  total_presupuestos_con_tecnica: number;
}

export interface PresupuestoAlerta {
  id: string;
  numero: string;
  cliente: string;
  /** Días transcurridos desde la fecha relevante de la alerta. */
  dias: number;
  /** Fecha relevante `YYYY-MM-DD`: emisión, caducidad o creación del borrador. */
  fecha: string;
}

export interface Alertas {
  /** Enviados hace más de 20 días sin respuesta. */
  sin_respuesta: PresupuestoAlerta[];
  /** Caducados dentro del período seleccionado. */
  caducados: PresupuestoAlerta[];
  /** Borradores sin tocar desde hace más de 7 días. */
  borradores_olvidados: PresupuestoAlerta[];
}

export interface Metricas {
  rango: RangoFechas;
  actividad: Actividad;
  top_clientes: TopClientes;
  distribucion_tecnica: DistribucionTecnica;
  alertas: Alertas;
  catalogo: EstadoCatalogo;
}
