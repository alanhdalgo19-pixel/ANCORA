// Cálculo de serigrafía — CLAUDE.md sección 7.4.
//
// El núcleo del algoritmo (`calcularBaseTarifaSerigrafia`) se exporta para que
// lo reutilice impresión directa, que comparte la misma tabla de tarifas pero
// tiene sus propios mínimo de trabajo y tramos de margen, y no cobra fotolitos
// ni pantones (CLAUDE.md sección 7.5).

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
  UbicacionSerigrafia,
} from "./types";

/** Fila de `tarifas_serigrafia`, ya filtrada por tipo de cliente. */
export interface FilaTarifaSerigrafia {
  ubicacion: UbicacionSerigrafia;
  num_colores: 1 | 2;
  desde: number;
  hasta: number;
  precio: number;
}

export interface SerigrafiaInput {
  cantidad: number;
  num_colores: 1 | 2;
  ubicacion: UbicacionSerigrafia;
  prenda_oscura: boolean;
  tipo_cliente: TipoCliente;
  /** Diseño nuevo: se cobran fotolitos como línea aparte. */
  trabajo_nuevo?: boolean;
  incluir_vectorizacion?: boolean;
  incluir_pantone?: boolean;
  /** Si se omite, se cobra un pantone por color. */
  cantidad_pantones?: number;
}

export interface SerigrafiaConfig {
  tarifa: FilaTarifaSerigrafia[];
  recargo_oscura_pecho_por_color: number;
  recargo_oscura_espalda_por_color: number;
  fotolito_pecho: number;
  fotolito_espalda: number;
  minimo_trabajo: number;
  pantone_por_color: number;
  vectorizacion: number;
  /** Tramos ya filtrados por técnica SERIGRAFIA y tipo de cliente. */
  tramos_margen: TramoMargen[];
}

/** Bloque `calculo` del snapshot de serigrafía e impresión directa. */
export interface SerigrafiaDetalleCalculo {
  precio_unitario_tarifa: number;
  tramo_tarifa: string;
  subtotal_tarifa: number;
  recargo_oscura: number;
  subtotal_con_recargo: number;
  coste_interno: number;
  aplicado_minimo: boolean;
}

export type SerigrafiaResultado = CalculoResultado<
  SerigrafiaInput,
  SerigrafiaDetalleCalculo
>;

/** Parte del cálculo común a serigrafía e impresión directa. */
export interface BaseTarifaArgs {
  cantidad: number;
  num_colores: 1 | 2;
  ubicacion: UbicacionSerigrafia;
  prenda_oscura: boolean;
  tarifa: FilaTarifaSerigrafia[];
  recargo_oscura_pecho_por_color: number;
  recargo_oscura_espalda_por_color: number;
  minimo_trabajo: number;
  tramos_margen: TramoMargen[];
}

export interface BaseTarifaResultado {
  calculo: SerigrafiaDetalleCalculo;
  margen_pct: number;
  tramo_cantidad: string;
  precio_pre_extras: number;
  precio_unitario: number;
}

/**
 * PASOS 1–7 de CLAUDE.md 7.4: busca tarifa, aplica recargo por prenda oscura,
 * mínimo de trabajo y margen. No genera extras — eso lo decide cada técnica.
 */
export function calcularBaseTarifaSerigrafia(
  args: BaseTarifaArgs,
): BaseTarifaResultado {
  validarCantidad(args.cantidad);

  // PASO 1 — límite de colores.
  if (args.num_colores > 2 || args.num_colores < 1) {
    throw new Error(
      `Máximo 2 colores soportados actualmente (se han pedido ${args.num_colores}). Consulta con Espe para trabajos de más colores.`,
    );
  }

  // PASO 2 — precio unitario de la tabla cruzada.
  const fila = args.tarifa.find(
    (f) =>
      f.ubicacion === args.ubicacion &&
      f.num_colores === args.num_colores &&
      args.cantidad >= f.desde &&
      args.cantidad <= f.hasta,
  );
  if (!fila) {
    throw new Error(
      `No hay tarifa aplicable para esta combinación: ${args.cantidad} uds, ${args.num_colores} color(es) en ${args.ubicacion}. Revisa las tarifas en el panel de administración.`,
    );
  }

  // PASO 3 — subtotal por unidades.
  const subtotalTarifa = redondear2(fila.precio * args.cantidad);

  // PASO 4 — recargo por prenda oscura, una vez por trabajo y por color.
  const recargoPorColor =
    args.ubicacion === "pecho"
      ? args.recargo_oscura_pecho_por_color
      : args.recargo_oscura_espalda_por_color;
  const recargoOscura = args.prenda_oscura
    ? redondear2(recargoPorColor * args.num_colores)
    : 0;
  const subtotalConRecargo = redondear2(subtotalTarifa + recargoOscura);

  // PASO 5 — mínimo de trabajo.
  const { coste: costeInterno, aplicado: aplicadoMinimo } =
    aplicarMinimoTrabajo(subtotalConRecargo, args.minimo_trabajo);

  // PASO 6–7 — margen comercial y precios finales.
  const margen = aplicarMargen(costeInterno, args.tramos_margen, args.cantidad);
  const precioPreExtras = margen.precio;

  return {
    calculo: {
      precio_unitario_tarifa: fila.precio,
      tramo_tarifa: `${fila.desde}-${fila.hasta}`,
      subtotal_tarifa: subtotalTarifa,
      recargo_oscura: recargoOscura,
      subtotal_con_recargo: subtotalConRecargo,
      coste_interno: costeInterno,
      aplicado_minimo: aplicadoMinimo,
    },
    margen_pct: margen.margen_pct,
    tramo_cantidad: margen.tramo,
    precio_pre_extras: precioPreExtras,
    precio_unitario: redondear2(precioPreExtras / args.cantidad),
  };
}

/**
 * Calcula una línea de serigrafía siguiendo CLAUDE.md sección 7.4.
 *
 * Redondeos: todos los importes a 2 decimales. El recargo por prenda oscura y
 * los fotolitos son cargos por trabajo (no por unidad), así que se suman una
 * sola vez aunque haya cientos de prendas.
 */
export function calcularSerigrafia(
  input: SerigrafiaInput,
  config: SerigrafiaConfig,
): SerigrafiaResultado {
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

  // PASO 8 — extras, en líneas aparte (no suman a `importe_linea`).
  const extras: Extra[] = [];

  if (input.trabajo_nuevo) {
    const fotolito =
      input.ubicacion === "pecho"
        ? config.fotolito_pecho
        : config.fotolito_espalda;
    extras.push({
      descripcion: `Fotolitos (${input.num_colores} color/es, ${input.ubicacion})`,
      importe: redondear2(fotolito * input.num_colores),
    });
  }

  if (input.incluir_vectorizacion) {
    extras.push({
      descripcion: "Vectorización",
      importe: redondear2(config.vectorizacion),
    });
  }

  if (input.incluir_pantone) {
    const numPantones = input.cantidad_pantones ?? input.num_colores;
    extras.push({
      descripcion: `Tinta pantone (${numPantones})`,
      importe: redondear2(config.pantone_por_color * numPantones),
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
      tecnica: "SERIGRAFIA",
      inputs: { ...input },
      parametros_aplicados: {
        recargo_oscura_pecho_por_color: config.recargo_oscura_pecho_por_color,
        recargo_oscura_espalda_por_color:
          config.recargo_oscura_espalda_por_color,
        fotolito_pecho: config.fotolito_pecho,
        fotolito_espalda: config.fotolito_espalda,
        minimo_trabajo: config.minimo_trabajo,
        pantone_por_color: config.pantone_por_color,
        vectorizacion: config.vectorizacion,
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
