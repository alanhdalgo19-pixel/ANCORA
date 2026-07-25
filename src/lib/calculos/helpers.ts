// Funciones auxiliares compartidas por todas las técnicas de cálculo.
// Todas son puras: sin fetch, sin acceso a base de datos, sin efectos.

import {
  VERSION_CALCULO,
  type CodigoTecnica,
  type DetalleCalculo,
  type Extra,
  type SnapshotComercial,
  type TramoMargen,
} from "./types";

/**
 * Redondea a 2 decimales usando redondeo **half-up** (el estándar comercial
 * español: 1.235 → 1.24), NO redondeo bancario.
 *
 * `Math.round(n * 100) / 100` a secas falla con números que en coma flotante
 * quedan justo por debajo del .5 (1.235 * 100 === 123.49999999999999, que
 * redondearía a 1.23). Se normaliza con `toPrecision(12)` para absorber el
 * error de representación antes de redondear: 12 cifras significativas están
 * muy por encima de la precisión que necesita un importe en euros y muy por
 * debajo de las ~17 en las que aparece el ruido binario.
 */
export function redondear2(n: number): number {
  if (!Number.isFinite(n)) {
    throw new Error(`No se puede redondear un valor no numérico: ${n}`);
  }
  return Math.round(Number((n * 100).toPrecision(12))) / 100;
}

/**
 * Eleva `coste` hasta `minimo` si se queda por debajo (mínimo de trabajo por
 * técnica: CLAUDE.md secciones 7.2 PASO 9, 7.3 PASO 5, 7.4 PASO 4).
 */
export function aplicarMinimoTrabajo(
  coste: number,
  minimo: number,
): { coste: number; aplicado: boolean } {
  if (coste < minimo) {
    return { coste: redondear2(minimo), aplicado: true };
  }
  return { coste: redondear2(coste), aplicado: false };
}

/**
 * Devuelve el tramo que contiene `cantidad`, o `null` si ninguno la cubre
 * (lo que indica un error de configuración de `tramos_margen`).
 * Los límites son inclusivos por ambos lados; `hasta: null` = infinito.
 */
export function buscarTramoMargen(
  tramos: TramoMargen[],
  cantidad: number,
): TramoMargen | null {
  return (
    tramos.find(
      (tramo) =>
        cantidad >= tramo.desde &&
        (tramo.hasta === null || cantidad <= tramo.hasta),
    ) ?? null
  );
}

/** Etiqueta legible del tramo para el snapshot: "100-499" o "500+". */
export function etiquetarTramo(tramo: TramoMargen): string {
  return tramo.hasta === null
    ? `${tramo.desde}+`
    : `${tramo.desde}-${tramo.hasta}`;
}

/**
 * Aplica el margen comercial correspondiente a `cantidad`.
 * Lanza si no hay tramo configurado que la cubra: preferimos un error visible
 * a presupuestar en silencio con margen 0.
 */
export function aplicarMargen(
  coste: number,
  tramos: TramoMargen[],
  cantidad: number,
): { precio: number; margen_pct: number; tramo: string } {
  const tramo = buscarTramoMargen(tramos, cantidad);
  if (!tramo) {
    throw new Error(
      `No hay tramo de margen configurado para una cantidad de ${cantidad} unidades. Revisa los márgenes en el panel de administración.`,
    );
  }
  return {
    precio: redondear2(coste * (1 + tramo.margen_pct / 100)),
    margen_pct: tramo.margen_pct,
    tramo: etiquetarTramo(tramo),
  };
}

/** Suma los importes de las líneas extra (picaje, fotolitos, vectorización…). */
export function calcularExtras(extras: Extra[]): number {
  return redondear2(extras.reduce((suma, extra) => suma + extra.importe, 0));
}

/**
 * Construye el snapshot inmutable de `lineas_presupuesto.detalle_calculo`
 * (CLAUDE.md sección 7.6).
 *
 * La firma incluye `tecnica` y `parametros_aplicados` además de los tres
 * bloques del enunciado, porque ambos forman parte de la estructura
 * documentada y sin ellos el snapshot no sería reproducible.
 */
export function construirSnapshot<TInputs, TCalculo>(args: {
  tecnica: CodigoTecnica;
  inputs: TInputs;
  parametros_aplicados: Record<string, number | string | boolean>;
  calculo: TCalculo;
  comercial: SnapshotComercial;
}): DetalleCalculo<TInputs, TCalculo> {
  return {
    tecnica: args.tecnica,
    version_calculo: VERSION_CALCULO,
    inputs: args.inputs,
    parametros_aplicados: args.parametros_aplicados,
    calculo: args.calculo,
    comercial: args.comercial,
  };
}

/** Valida la cantidad común a todas las técnicas. */
export function validarCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new Error("La cantidad debe ser un número entero mayor que cero.");
  }
}
