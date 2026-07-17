import type {
  ParametrosImpresionDirecta,
  TarifaSerigrafia,
  TipoCliente,
  Ubicacion,
} from "@/types/database";

export interface ImpresionDirectaCalculoInputs {
  cantidad: number;
  numColores: number;
  ubicacion: Ubicacion;
  prendaOscura: boolean;
  tipoCliente: TipoCliente;
}

export interface ImpresionDirectaCalculoResultado {
  precioUnitario: number;
  subtotal: number;
  detalleCalculo: unknown;
}

/**
 * Calcula el precio de impresión directa según CLAUDE.md sección 7.5.
 * Reutiliza `tarifas_serigrafia` SIN sumar fotolitos ni pantones.
 * TODO: implementar (pendiente de fase de cálculo).
 */
export function calculateImpresionDirectaPrice(
  _inputs: ImpresionDirectaCalculoInputs,
  _tarifas: TarifaSerigrafia[],
  _parametros: ParametrosImpresionDirecta,
): ImpresionDirectaCalculoResultado {
  throw new Error(
    "calculateImpresionDirectaPrice: pendiente de implementar (fase 1)",
  );
}
