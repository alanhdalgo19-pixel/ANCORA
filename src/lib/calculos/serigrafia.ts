import type {
  ParametrosSerigrafia,
  TarifaSerigrafia,
  TipoCliente,
  Ubicacion,
} from "@/types/database";

export interface SerigrafiaCalculoInputs {
  cantidad: number;
  numColores: number;
  ubicacion: Ubicacion;
  prendaOscura: boolean;
  tipoCliente: TipoCliente;
}

export interface SerigrafiaCalculoResultado {
  precioUnitario: number;
  subtotal: number;
  fotolitos: number;
  detalleCalculo: unknown;
}

/**
 * Calcula el precio de una línea de serigrafía según CLAUDE.md sección 7.4.
 * Máximo 2 colores soportado — bloquear en la UI si numColores > 2.
 * TODO: implementar los 6 pasos del algoritmo (pendiente de fase de cálculo).
 */
export function calculateSerigrafiaPrice(
  _inputs: SerigrafiaCalculoInputs,
  _tarifas: TarifaSerigrafia[],
  _parametros: ParametrosSerigrafia,
): SerigrafiaCalculoResultado {
  throw new Error(
    "calculateSerigrafiaPrice: pendiente de implementar (fase 1)",
  );
}
