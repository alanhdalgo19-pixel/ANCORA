import type { ParametrosDtf, Posicion, TipoCliente } from "@/types/database";

export interface DtfCalculoInputs {
  cantidad: number;
  anchoLogoCm: number;
  altoLogoCm: number;
  posicion: Posicion;
  tipoCliente: TipoCliente;
  disenoNuevo: boolean;
}

export interface DtfCalculoResultado {
  costeInterno: number;
  margenPct: number;
  precioUnitario: number;
  detalleCalculo: unknown;
}

/**
 * Calcula el precio de una línea DTF según CLAUDE.md sección 7.2.
 * TODO: implementar los 12 pasos del algoritmo (pendiente de fase de cálculo).
 */
export function calculateDtfPrice(
  _inputs: DtfCalculoInputs,
  _parametros: ParametrosDtf,
  _margenPct: number,
): DtfCalculoResultado {
  throw new Error("calculateDtfPrice: pendiente de implementar (fase 1)");
}
