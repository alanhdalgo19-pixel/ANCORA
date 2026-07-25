// Cálculo de bordado — CLAUDE.md sección 7.3.

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

export type TarifaBordado =
  | "tarifa_1"
  | "tarifa_2"
  | "tarifa_3"
  | "personalizada";

export type UnidadMedidaBordado =
  | "por_puntada"
  | "por_100_puntadas"
  | "por_1000_puntadas";

export type CodigoPicaje =
  | "SENCILLO"
  | "MEDIO"
  | "COMPLEJO"
  | "PERSONALIZADO";

export interface BordadoInput {
  cantidad: number;
  puntadas: number;
  tarifa_seleccionada: TarifaBordado;
  /** Obligatorio si `tarifa_seleccionada` es "personalizada". */
  precio_personalizado?: number;
  posicion: Ubicacion;
  tipo_cliente: TipoCliente;
  /** Solo se aplica si `tipo_cliente` es "habitual" (CLAUDE.md 7.3 PASO 2). */
  descuento_habitual_pct?: number;
  /** Diseño nuevo: se cobra picaje como línea aparte. */
  trabajo_nuevo?: boolean;
  tipo_picaje?: CodigoPicaje;
  /** Solo aplicable al picaje PERSONALIZADO (`editable_en_presupuesto`). */
  precio_picaje_personalizado?: number;
}

export interface BordadoConfig {
  precio_tarifa_1: number;
  precio_tarifa_2: number;
  precio_tarifa_3: number;
  precio_personalizable_default: number;
  unidad_medida: UnidadMedidaBordado;
  minimo_pieza: number;
  minimo_trabajo: number;
  precios_picaje: Record<CodigoPicaje, number>;
  /** Tramos ya filtrados por técnica BORDADO y tipo de cliente. */
  tramos_margen: TramoMargen[];
}

/** Bloque `calculo` del snapshot de bordado. */
export interface BordadoDetalleCalculo {
  precio_tarifa_aplicada: number;
  /** Precio por pieza según puntadas y unidad, antes de descuento y mínimos. */
  precio_unitario_tarifa: number;
  descuento_habitual_pct: number;
  precio_unitario_con_descuento: number;
  /** Precio por pieza definitivo, ya con el mínimo por pieza aplicado. */
  precio_unitario_pieza: number;
  aplicado_minimo_pieza: boolean;
  /** Suma de piezas antes del mínimo de trabajo. */
  subtotal_bordado: number;
  aplicado_minimo_trabajo: boolean;
  coste_interno: number;
}

export type BordadoResultado = CalculoResultado<
  BordadoInput,
  BordadoDetalleCalculo
>;

const NOMBRE_PICAJE: Record<CodigoPicaje, string> = {
  SENCILLO: "Picaje sencillo",
  MEDIO: "Picaje medio",
  COMPLEJO: "Picaje complejo",
  PERSONALIZADO: "Picaje personalizado",
};

/** Divisor que convierte "puntadas" en la unidad de la tarifa. */
const DIVISOR_UNIDAD: Record<UnidadMedidaBordado, number> = {
  por_puntada: 1,
  por_100_puntadas: 100,
  por_1000_puntadas: 1000,
};

function resolverTarifa(input: BordadoInput, config: BordadoConfig): number {
  switch (input.tarifa_seleccionada) {
    case "tarifa_1":
      return config.precio_tarifa_1;
    case "tarifa_2":
      return config.precio_tarifa_2;
    case "tarifa_3":
      return config.precio_tarifa_3;
    case "personalizada":
      return input.precio_personalizado ?? config.precio_personalizable_default;
  }
}

function resolverPicaje(input: BordadoInput, config: BordadoConfig): Extra {
  const tipo = input.tipo_picaje;
  if (!tipo) {
    throw new Error(
      "Un trabajo de bordado nuevo necesita un tipo de picaje seleccionado.",
    );
  }
  const importe =
    tipo === "PERSONALIZADO" && input.precio_picaje_personalizado !== undefined
      ? input.precio_picaje_personalizado
      : config.precios_picaje[tipo];

  return { descripcion: NOMBRE_PICAJE[tipo], importe: redondear2(importe) };
}

/**
 * Calcula una línea de bordado siguiendo los pasos de CLAUDE.md sección 7.3.
 *
 * Redondeos: el precio por pieza se redondea a céntimos ANTES de multiplicar
 * por la cantidad, porque es el importe que aparece por unidad en el
 * presupuesto y el cliente espera que unitario × cantidad cuadre.
 *
 * OJO — `unidad_medida` sigue pendiente de confirmar con Espe (CLAUDE.md
 * sección 10, punto 15). La fórmula soporta las tres opciones; elegir la
 * equivocada cambia el precio en un factor de 10 o 1000.
 */
export function calcularBordado(
  input: BordadoInput,
  config: BordadoConfig,
): BordadoResultado {
  validarCantidad(input.cantidad);

  if (input.puntadas <= 0) {
    throw new Error("El número de puntadas debe ser mayor que cero.");
  }
  if (
    input.tarifa_seleccionada === "personalizada" &&
    input.precio_personalizado !== undefined &&
    input.precio_personalizado <= 0
  ) {
    throw new Error("El precio personalizado de bordado debe ser mayor que cero.");
  }

  // PASO 1–2 — precio por pieza según puntadas y unidad de medida.
  const precioTarifa = resolverTarifa(input, config);
  const precioUnitarioTarifa = redondear2(
    (input.puntadas / DIVISOR_UNIDAD[config.unidad_medida]) * precioTarifa,
  );

  // PASO 3 — descuento del cliente habitual, ANTES del mínimo por pieza.
  const descuentoPct =
    input.tipo_cliente === "habitual" ? (input.descuento_habitual_pct ?? 0) : 0;
  const precioConDescuento = redondear2(
    precioUnitarioTarifa * (1 - descuentoPct / 100),
  );

  // PASO 4 — mínimo por pieza.
  const {
    coste: precioUnitarioPieza,
    aplicado: aplicadoMinimoPieza,
  } = aplicarMinimoTrabajo(precioConDescuento, config.minimo_pieza);

  // PASO 5–6 — subtotal y mínimo de trabajo.
  const subtotalBordado = redondear2(precioUnitarioPieza * input.cantidad);
  const { coste: costeInterno, aplicado: aplicadoMinimoTrabajo } =
    aplicarMinimoTrabajo(subtotalBordado, config.minimo_trabajo);

  // PASO 7–8 — margen comercial y precios finales.
  const margen = aplicarMargen(
    costeInterno,
    config.tramos_margen,
    input.cantidad,
  );
  const precioPreExtras = margen.precio;
  const precioUnitario = redondear2(precioPreExtras / input.cantidad);

  // PASO 9 — picaje como línea aparte.
  const extras: Extra[] = [];
  if (input.trabajo_nuevo) {
    extras.push(resolverPicaje(input, config));
  }

  return {
    coste_interno: costeInterno,
    margen_aplicado_pct: margen.margen_pct,
    precio_unitario: precioUnitario,
    importe_linea: precioPreExtras,
    aplicado_minimo: aplicadoMinimoPieza || aplicadoMinimoTrabajo,
    extras,
    detalle_calculo: construirSnapshot({
      tecnica: "BORDADO",
      inputs: { ...input },
      parametros_aplicados: {
        precio_tarifa_1: config.precio_tarifa_1,
        precio_tarifa_2: config.precio_tarifa_2,
        precio_tarifa_3: config.precio_tarifa_3,
        precio_personalizable_default: config.precio_personalizable_default,
        unidad_medida: config.unidad_medida,
        minimo_pieza: config.minimo_pieza,
        minimo_trabajo: config.minimo_trabajo,
      },
      calculo: {
        precio_tarifa_aplicada: precioTarifa,
        precio_unitario_tarifa: precioUnitarioTarifa,
        descuento_habitual_pct: descuentoPct,
        precio_unitario_con_descuento: precioConDescuento,
        precio_unitario_pieza: precioUnitarioPieza,
        aplicado_minimo_pieza: aplicadoMinimoPieza,
        subtotal_bordado: subtotalBordado,
        aplicado_minimo_trabajo: aplicadoMinimoTrabajo,
        coste_interno: costeInterno,
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
