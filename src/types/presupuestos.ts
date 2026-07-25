// Tipos del wizard de presupuesto (Prompt 6).
//
// Separados de `database.ts` porque no son filas de tabla: son la forma de los
// datos que el wizard recoge en pantalla y envía a las Server Actions, más la
// forma del resultado que devuelve el motor de cálculo ya envuelto para la UI.

import type {
  CodigoPicaje,
  CodigoTecnica,
  ColorGrupo,
  Posicion,
  TipoLinea,
  Ubicacion,
  UnidadMedidaBordado,
} from "@/types/database";
import type { TarifaBordado } from "@/lib/calculos";

/**
 * Parámetros que el wizard necesita para pintar el paso 4 (importes de
 * fotolitos, tarifas de bordado, picajes…). Se cargan una vez en el Server
 * Component y bajan como props a los formularios, que son client components.
 */
export interface ParametrosWizard {
  vectorizacion: number;
  fotolito_pecho: number;
  fotolito_espalda: number;
  pantone_por_color: number;
  bordado: {
    precio_tarifa_1: number;
    precio_tarifa_2: number;
    precio_tarifa_3: number;
    precio_personalizable_default: number;
    unidad_medida: UnidadMedidaBordado;
  };
  picajes: {
    codigo: CodigoPicaje;
    nombre: string;
    precio_base: number;
    editable_en_presupuesto: boolean;
  }[];
  /** Falso mientras `parametros_sublimacion.precio_unitario_base` sea 0. */
  sublimacion_disponible: boolean;
}

/** Detalles del paso 4 del wizard, uno por técnica. */
export type DetallesTecnica =
  | {
      tecnica: "DTF";
      posicion: Posicion;
      ancho_logo_cm: number;
      alto_logo_cm: number;
      incluir_vectorizacion: boolean;
    }
  | {
      tecnica: "BORDADO";
      posicion: Posicion;
      ancho_logo_cm: number | null;
      alto_logo_cm: number | null;
      puntadas: number;
      tarifa: TarifaBordado;
      precio_personalizado: number | null;
      trabajo_nuevo: boolean;
      tipo_picaje: CodigoPicaje | null;
      precio_picaje_personalizado: number | null;
    }
  | {
      tecnica: "SERIGRAFIA";
      ubicacion: Ubicacion;
      num_colores: 1 | 2;
      prenda_oscura: boolean;
      trabajo_nuevo: boolean;
      incluir_vectorizacion: boolean;
      incluir_pantone: boolean;
      cantidad_pantones: number | null;
    }
  | {
      tecnica: "IMPRESION_DIRECTA";
      ubicacion: Ubicacion;
      num_colores: 1 | 2;
      prenda_oscura: boolean;
      incluir_vectorizacion: boolean;
    }
  | {
      tecnica: "SUBLIMACION";
      posicion: Posicion;
    };

/** Todo lo que recoge el wizard para construir una línea (pasos 2 a 4). */
export interface DatosLineaWizard {
  cantidad: number;
  prenda_id: string | null;
  color: string | null;
  color_grupo: ColorGrupo | null;
  detalles: DetallesTecnica;
}

/** Una fila del preview del paso 5 (y del resumen tras guardar). */
export interface FilaPreviewLinea {
  descripcion: string;
  detalle: string | null;
  cantidad: number;
  precio_unitario: number;
  importe: number;
}

/** Resultado del cálculo de una línea, listo para pintar en el paso 5. */
export interface PreviewLinea {
  /** Línea de venta de prenda, si el usuario añadió prenda al presupuesto. */
  prenda: FilaPreviewLinea | null;
  /** `true` si la prenda tiene precio 0 configurado en el panel admin. */
  prenda_sin_precio: boolean;
  /** Línea de personalización (la que genera el motor de cálculo). */
  tecnica: FilaPreviewLinea;
  /** Picaje, fotolitos, vectorización, pantones: van en líneas aparte. */
  extras: FilaPreviewLinea[];
  /** Desglose interno, solo informativo para Sonia y Espe. */
  desglose: {
    coste_interno: number;
    margen_pct: number;
    aplicado_minimo: boolean;
    tramo_cantidad: string;
  };
  /** Suma de prenda + técnica + extras, sin IVA. */
  total: number;
}

/** Línea guardada, tal como la pintan la tabla del resumen y el preview. */
export interface LineaVista {
  id: string;
  orden: number;
  tipo_linea: TipoLinea;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  importe_linea: number;
  detalle_calculo: unknown;
  linea_padre_id: string | null;
}

/** Respuesta uniforme de las Server Actions que pueden fallar por negocio. */
export type ResultadoAccion<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string };

/** Snapshot que se guarda en una línea de tipo 'prenda'. */
export interface PrendaSnapshot {
  tipo: "PRENDA";
  version_calculo: string;
  inputs: {
    prenda_id: string;
    cantidad: number;
    color: string | null;
    color_grupo: ColorGrupo;
    tipo_cliente: string;
  };
  calculo: {
    precio_unitario: number;
    tramo_cantidad: string;
    importe_linea: number;
  };
}

/** Snapshot que se guarda en una línea de tipo 'extra'. */
export interface ExtraSnapshot {
  tipo: "EXTRA";
  version_calculo: string;
  origen: CodigoTecnica;
  descripcion: string;
  importe: number;
}
