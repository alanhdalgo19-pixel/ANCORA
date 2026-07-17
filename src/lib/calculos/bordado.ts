import type { ParametrosBordado, TipoCliente } from "@/types/database";

export interface BordadoCalculoInputs {
  cantidad: number;
  puntadas: number;
  tarifaSeleccionada: "tarifa_1" | "tarifa_2" | "tarifa_3" | "personalizado";
  precioPersonalizado?: number;
  tipoCliente: TipoCliente;
  descuentoBordadoPct: number;
}

export interface BordadoCalculoResultado {
  precioUnitario: number;
  subtotal: number;
  detalleCalculo: unknown;
}

/**
 * Calcula el precio de una línea de bordado según CLAUDE.md sección 7.3.
 * TODO: implementar los 6 pasos del algoritmo (pendiente de fase de cálculo).
 */
export function calculateBordadoPrice(
  _inputs: BordadoCalculoInputs,
  _parametros: ParametrosBordado,
): BordadoCalculoResultado {
  throw new Error("calculateBordadoPrice: pendiente de implementar (fase 1)");
}
