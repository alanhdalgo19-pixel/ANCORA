import type { ParametrosSublimacion, TipoCliente } from "@/types/database";

export interface SublimacionCalculoInputs {
  cantidad: number;
  tipoCliente: TipoCliente;
}

export interface SublimacionCalculoResultado {
  precioUnitario: number;
  subtotal: number;
  detalleCalculo: unknown;
}

/**
 * Calcula el precio de sublimación — CLAUDE.md sección 7.5: estructura y
 * tarifa PENDIENTES de confirmar con Espe (ver sección 10, punto 5).
 * TODO: implementar cuando se confirme la tarifa real.
 */
export function calculateSublimacionPrice(
  _inputs: SublimacionCalculoInputs,
  _parametros: ParametrosSublimacion,
): SublimacionCalculoResultado {
  throw new Error(
    "calculateSublimacionPrice: pendiente de tarifa real de Espe",
  );
}
