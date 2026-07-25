// Cálculo de impresión directa — CLAUDE.md sección 7.5.
//
// DECISIÓN DE IMPLEMENTACIÓN: no es una envoltura de `calcularSerigrafia` sino
// que ambas comparten el núcleo `calcularBaseTarifaSerigrafia`. Motivo: aunque
// reutiliza la misma tabla `tarifas_serigrafia`, la impresión directa tiene su
// PROPIO mínimo de trabajo (15 € frente a 20 €) y sus propios tramos de margen
// en `tramos_margen`. Envolver la función de serigrafía obligaría a pasarle una
// config de serigrafía falseada (con fotolitos y pantones que nunca se usan) y
// luego parchear el snapshot a posteriori. Compartir el núcleo deja explícito
// qué se comparte y qué no.

import { construirSnapshot, redondear2 } from "./helpers";
import {
  calcularBaseTarifaSerigrafia,
  type FilaTarifaSerigrafia,
  type SerigrafiaDetalleCalculo,
} from "./serigrafia";
import type {
  CalculoResultado,
  Extra,
  TipoCliente,
  TramoMargen,
  UbicacionSerigrafia,
} from "./types";

export interface ImpresionDirectaInput {
  cantidad: number;
  num_colores: 1 | 2;
  ubicacion: UbicacionSerigrafia;
  prenda_oscura: boolean;
  tipo_cliente: TipoCliente;
  /**
   * Se acepta por simetría con serigrafía, pero NO genera fotolitos: en
   * impresión directa no hay pantallas que preparar.
   */
  trabajo_nuevo?: boolean;
  incluir_vectorizacion?: boolean;
}

export interface ImpresionDirectaConfig {
  /** Misma tabla que serigrafía, ya filtrada por tipo de cliente. */
  tarifa: FilaTarifaSerigrafia[];
  recargo_oscura_pecho_por_color: number;
  recargo_oscura_espalda_por_color: number;
  /** Propio de impresión directa: 15 € por defecto, no los 20 € de serigrafía. */
  minimo_trabajo: number;
  vectorizacion: number;
  /** Tramos ya filtrados por técnica IMPRESION_DIRECTA y tipo de cliente. */
  tramos_margen: TramoMargen[];
}

export type ImpresionDirectaResultado = CalculoResultado<
  ImpresionDirectaInput,
  SerigrafiaDetalleCalculo
>;

/**
 * Calcula una línea de impresión directa: idéntica a serigrafía salvo que
 * nunca añade fotolitos ni pantones (CLAUDE.md sección 7.5).
 */
export function calcularImpresionDirecta(
  input: ImpresionDirectaInput,
  config: ImpresionDirectaConfig,
): ImpresionDirectaResultado {
  const base = calcularBaseTarifaSerigrafia({
    cantidad: input.cantidad,
    num_colores: input.num_colores,
    ubicacion: input.ubicacion,
    prenda_oscura: input.prenda_oscura,
    tarifa: config.tarifa,
    recargo_oscura_pecho_por_color: config.recargo_oscura_pecho_por_color,
    recargo_oscura_espalda_por_color: config.recargo_oscura_espalda_por_color,
    minimo_trabajo: config.minimo_trabajo,
    tramos_margen: config.tramos_margen,
  });

  // Sin fotolitos ni pantones: el único extra posible es la vectorización.
  const extras: Extra[] = [];
  if (input.incluir_vectorizacion) {
    extras.push({
      descripcion: "Vectorización",
      importe: redondear2(config.vectorizacion),
    });
  }

  return {
    coste_interno: base.calculo.coste_interno,
    margen_aplicado_pct: base.margen_pct,
    precio_unitario: base.precio_unitario,
    importe_linea: base.precio_pre_extras,
    aplicado_minimo: base.calculo.aplicado_minimo,
    extras,
    detalle_calculo: construirSnapshot({
      tecnica: "IMPRESION_DIRECTA",
      inputs: { ...input },
      parametros_aplicados: {
        recargo_oscura_pecho_por_color: config.recargo_oscura_pecho_por_color,
        recargo_oscura_espalda_por_color:
          config.recargo_oscura_espalda_por_color,
        minimo_trabajo: config.minimo_trabajo,
        vectorizacion: config.vectorizacion,
        usa_tarifa_serigrafia: true,
      },
      calculo: base.calculo,
      comercial: {
        tipo_cliente: input.tipo_cliente,
        tramo_cantidad: base.tramo_cantidad,
        margen_pct: base.margen_pct,
        precio_pre_extras: base.precio_pre_extras,
        extras,
        precio_unitario: base.precio_unitario,
      },
    }),
  };
}
