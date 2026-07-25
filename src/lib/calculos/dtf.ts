// Cálculo de DTF — CLAUDE.md sección 7.2.
//
// Versión SIMPLE: asume un único tamaño de logo por línea. El bin packing con
// logos de varios tamaños en el mismo rollo es un módulo aparte (Prompt 5).

import {
  aplicarMargen,
  aplicarMinimoTrabajo,
  construirSnapshot,
  redondear2,
  validarCantidad,
} from "./helpers";
import type {
  CalculoResultado,
  Extra,
  TipoCliente,
  TramoMargen,
  Ubicacion,
} from "./types";

export interface DtfInput {
  cantidad: number;
  ancho_logo_cm: number;
  alto_logo_cm: number;
  posicion: Ubicacion;
  tipo_cliente: TipoCliente;
  /** Diseño nuevo que hay que vectorizar (CLAUDE.md 7.2 PASO 12). */
  incluir_vectorizacion?: boolean;
  /** Obligatorio si `incluir_vectorizacion` es true. */
  precio_vectorizacion?: number;
}

export interface DtfConfig {
  ancho_rollo_cm: number;
  precio_metro: number;
  recorte_por_logo: number;
  mano_obra_por_minuto: number;
  preparacion_pct: number;
  minimo_trabajo: number;
  margen_seguridad_cm: number;
  minutos_setup_fijo: number;
  minutos_por_logo: number;
  /** Tramos ya filtrados por técnica DTF y tipo de cliente. */
  tramos_margen: TramoMargen[];
}

/** Bloque `calculo` del snapshot DTF. */
export interface DtfDetalleCalculo {
  logos_por_fila: number;
  filas_necesarias: number;
  metros_necesarios: number;
  minutos_estimados: number;
  material: number;
  recorte: number;
  mano_obra: number;
  subtotal_sin_preparacion: number;
  preparacion: number;
  coste_interno: number;
  aplicado_minimo: boolean;
}

export type DtfResultado = CalculoResultado<DtfInput, DtfDetalleCalculo>;

/**
 * Calcula una línea de DTF siguiendo los pasos de CLAUDE.md sección 7.2.
 *
 * Redondeos:
 * - `logos_por_fila` (floor) y `filas_necesarias` (ceil) son enteros por
 *   naturaleza física: no cabe medio logo a lo ancho ni se imprime media fila.
 * - `minutos_estimados` se redondea al entero más próximo (half-up).
 * - `metros_necesarios` y todos los importes, a 2 decimales.
 * - El coste interno es la suma de los componentes YA redondeados, para que el
 *   desglose del snapshot cuadre céntimo a céntimo al mostrarlo.
 */
export function calcularDTF(input: DtfInput, config: DtfConfig): DtfResultado {
  validarCantidad(input.cantidad);

  if (input.ancho_logo_cm <= 0 || input.alto_logo_cm <= 0) {
    throw new Error("Las medidas del logo deben ser mayores que cero.");
  }

  // PASO 1 — cuántos logos caben a lo ancho del rollo.
  const logosPorFila = Math.floor(
    (config.ancho_rollo_cm - config.margen_seguridad_cm) /
      (input.ancho_logo_cm + config.margen_seguridad_cm),
  );
  if (logosPorFila <= 0) {
    throw new Error(
      `El logo es demasiado ancho para el rollo: ${input.ancho_logo_cm} cm no caben en un rollo de ${config.ancho_rollo_cm} cm.`,
    );
  }

  // PASO 2–3 — superficie de rollo consumida.
  const filasNecesarias = Math.ceil(input.cantidad / logosPorFila);
  const metrosNecesarios = redondear2(
    (filasNecesarias * (input.alto_logo_cm + config.margen_seguridad_cm)) / 100,
  );

  // PASO 4–7 — componentes del coste.
  const material = redondear2(metrosNecesarios * config.precio_metro);
  const recorte = redondear2(input.cantidad * config.recorte_por_logo);
  const minutosEstimados = Math.round(
    config.minutos_setup_fijo + config.minutos_por_logo * input.cantidad,
  );
  const manoObra = redondear2(minutosEstimados * config.mano_obra_por_minuto);

  // PASO 8–10 — preparación y coste interno.
  const subtotalSinPreparacion = redondear2(material + recorte + manoObra);
  const preparacion = redondear2(
    subtotalSinPreparacion * (config.preparacion_pct / 100),
  );
  const costeBruto = redondear2(subtotalSinPreparacion + preparacion);

  // PASO 11 — mínimo de trabajo.
  const { coste: costeInterno, aplicado: aplicadoMinimo } =
    aplicarMinimoTrabajo(costeBruto, config.minimo_trabajo);

  // PASO 12–13 — margen comercial.
  const margen = aplicarMargen(
    costeInterno,
    config.tramos_margen,
    input.cantidad,
  );

  // PASO 14–15 — precios. `importe_linea` es el valor autoritativo; el
  // unitario se redondea solo para mostrarlo en el PDF.
  const precioPreExtras = margen.precio;
  const precioUnitario = redondear2(precioPreExtras / input.cantidad);

  // PASO 16 — extras, en líneas aparte (no suman a `importe_linea`).
  const extras: Extra[] = [];
  if (input.incluir_vectorizacion) {
    if (
      input.precio_vectorizacion === undefined ||
      input.precio_vectorizacion < 0
    ) {
      throw new Error(
        "Falta el precio de vectorización para un diseño nuevo de DTF.",
      );
    }
    extras.push({
      descripcion: "Vectorización",
      importe: redondear2(input.precio_vectorizacion),
    });
  }

  return {
    coste_interno: costeInterno,
    margen_aplicado_pct: margen.margen_pct,
    precio_unitario: precioUnitario,
    importe_linea: precioPreExtras,
    aplicado_minimo: aplicadoMinimo,
    extras,
    detalle_calculo: construirSnapshot({
      tecnica: "DTF",
      inputs: { ...input },
      parametros_aplicados: {
        ancho_rollo_cm: config.ancho_rollo_cm,
        precio_metro: config.precio_metro,
        recorte_por_logo: config.recorte_por_logo,
        mano_obra_por_minuto: config.mano_obra_por_minuto,
        preparacion_pct: config.preparacion_pct,
        minimo_trabajo: config.minimo_trabajo,
        margen_seguridad_cm: config.margen_seguridad_cm,
        minutos_setup_fijo: config.minutos_setup_fijo,
        minutos_por_logo: config.minutos_por_logo,
      },
      calculo: {
        logos_por_fila: logosPorFila,
        filas_necesarias: filasNecesarias,
        metros_necesarios: metrosNecesarios,
        minutos_estimados: minutosEstimados,
        material,
        recorte,
        mano_obra: manoObra,
        subtotal_sin_preparacion: subtotalSinPreparacion,
        preparacion,
        coste_interno: costeInterno,
        aplicado_minimo: aplicadoMinimo,
      },
      comercial: {
        tipo_cliente: input.tipo_cliente,
        tramo_cantidad: margen.tramo,
        margen_pct: margen.margen_pct,
        precio_pre_extras: precioPreExtras,
        extras,
        precio_unitario: precioUnitario,
      },
    }),
  };
}
