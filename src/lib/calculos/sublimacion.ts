// Cálculo de sublimación — CLAUDE.md sección 7.5.
//
// ⚠️ TARIFA PENDIENTE DE ESPE (CLAUDE.md sección 10, punto 5). La estructura de
// `parametros_sublimacion` es provisional y está sembrada a 0, así que la
// función falla en seco mientras no haya precio configurado: preferimos
// bloquear el presupuesto a emitir un importe inventado.

import {
  aplicarMargen,
  aplicarMinimoTrabajo,
  construirSnapshot,
  redondear2,
  validarCantidad,
} from "./helpers";
import type {
  CalculoResultado,
  TipoCliente,
  TramoMargen,
  Ubicacion,
} from "./types";

export interface SublimacionInput {
  cantidad: number;
  posicion: Ubicacion;
  tipo_cliente: TipoCliente;
}

export interface SublimacionConfig {
  precio_unitario_base: number;
  cantidad_minima: number;
  /** Merma por piezas estropeadas en el proceso. Espe avisó de riesgo alto. */
  tasa_merma_pct: number;
  solo_blanco_poliester: boolean;
  minimo_trabajo: number;
  /** Tramos ya filtrados por técnica SUBLIMACION y tipo de cliente. */
  tramos_margen: TramoMargen[];
}

/** Bloque `calculo` del snapshot de sublimación. */
export interface SublimacionDetalleCalculo {
  subtotal_base: number;
  merma: number;
  subtotal_con_merma: number;
  coste_interno: number;
  aplicado_minimo: boolean;
}

export type SublimacionResultado = CalculoResultado<
  SublimacionInput,
  SublimacionDetalleCalculo
>;

/**
 * Calcula una línea de sublimación con la estructura provisional actual.
 * Todos los importes se redondean a 2 decimales.
 */
export function calcularSublimacion(
  input: SublimacionInput,
  config: SublimacionConfig,
): SublimacionResultado {
  validarCantidad(input.cantidad);

  // PASO 0 — sin tarifa no se puede presupuestar.
  if (!config.precio_unitario_base || config.precio_unitario_base <= 0) {
    throw new Error(
      "Tarifa de sublimación pendiente de configurar (PTE TARIFA ESPE). Introduce el precio por unidad en el panel de administración antes de presupuestar sublimación.",
    );
  }

  // PASO 1 — cantidad mínima del proceso.
  if (input.cantidad < config.cantidad_minima) {
    throw new Error(
      `Cantidad mínima de sublimación no alcanzada: se piden ${input.cantidad} uds y el mínimo es ${config.cantidad_minima}.`,
    );
  }

  // PASO 2–3 — subtotal y merma.
  const subtotalBase = redondear2(
    input.cantidad * config.precio_unitario_base,
  );
  const merma =
    config.tasa_merma_pct > 0
      ? redondear2(subtotalBase * (config.tasa_merma_pct / 100))
      : 0;
  const subtotalConMerma = redondear2(subtotalBase + merma);

  // PASO 4 — mínimo de trabajo.
  const { coste: costeInterno, aplicado: aplicadoMinimo } =
    aplicarMinimoTrabajo(subtotalConMerma, config.minimo_trabajo);

  // PASO 5–6 — margen y precios finales.
  const margen = aplicarMargen(
    costeInterno,
    config.tramos_margen,
    input.cantidad,
  );
  const precioPreExtras = margen.precio;
  const precioUnitario = redondear2(precioPreExtras / input.cantidad);

  return {
    coste_interno: costeInterno,
    margen_aplicado_pct: margen.margen_pct,
    precio_unitario: precioUnitario,
    importe_linea: precioPreExtras,
    aplicado_minimo: aplicadoMinimo,
    extras: [],
    detalle_calculo: construirSnapshot({
      tecnica: "SUBLIMACION",
      inputs: { ...input },
      parametros_aplicados: {
        precio_unitario_base: config.precio_unitario_base,
        cantidad_minima: config.cantidad_minima,
        tasa_merma_pct: config.tasa_merma_pct,
        solo_blanco_poliester: config.solo_blanco_poliester,
        minimo_trabajo: config.minimo_trabajo,
      },
      calculo: {
        subtotal_base: subtotalBase,
        merma,
        subtotal_con_merma: subtotalConMerma,
        coste_interno: costeInterno,
        aplicado_minimo: aplicadoMinimo,
      },
      comercial: {
        tipo_cliente: input.tipo_cliente,
        tramo_cantidad: margen.tramo,
        margen_pct: margen.margen_pct,
        precio_pre_extras: precioPreExtras,
        extras: [],
        precio_unitario: precioUnitario,
      },
    }),
  };
}
