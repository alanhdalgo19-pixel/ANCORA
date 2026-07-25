// Tipos compartidos del motor de cálculo (CLAUDE.md sección 7).
//
// NOTA sobre nombres: algunos tipos de este módulo coinciden en nombre con
// tipos de `src/types/database.ts` pero NO son lo mismo:
//
//   - `TramoMargen` aquí es la forma *de cálculo* ({ desde, hasta, margen_pct }),
//     mientras que en `database.ts` es la fila cruda de la tabla `tramos_margen`
//     (con `id`, `tecnica_id`, `tipo_cliente`, `desde_cantidad`, …). El motor
//     recibe los tramos ya filtrados por técnica y tipo de cliente.
//   - `Ubicacion` aquí equivale a `Posicion` de `database.ts` (5 valores).
//     Para serigrafía e impresión directa, que solo admiten pecho/espalda, se
//     usa `UbicacionSerigrafia`.
//
// El motor es deliberadamente independiente del esquema: recibe todo por
// argumento para poder testearse sin Supabase.

export type TipoCliente = "esporadico" | "habitual";
export type Ubicacion = "pecho" | "espalda" | "manga" | "gorra" | "otro";
export type UbicacionSerigrafia = "pecho" | "espalda";
export type ColorGrupo = "blanco" | "color" | "oscuro";

export type CodigoTecnica =
  | "DTF"
  | "BORDADO"
  | "SERIGRAFIA"
  | "SUBLIMACION"
  | "IMPRESION_DIRECTA";

/** Versión del motor grabada en cada snapshot. Subirla si cambia una fórmula. */
export const VERSION_CALCULO = "1.0";

/** Tramo de margen comercial, ya filtrado por técnica y tipo de cliente. */
export interface TramoMargen {
  desde: number;
  /** `null` = sin límite superior. */
  hasta: number | null;
  margen_pct: number;
}

/** Línea extra que se presupuesta aparte (picaje, fotolitos, vectorización…). */
export interface Extra {
  descripcion: string;
  importe: number;
}

/** Bloque `comercial` del snapshot `detalle_calculo`. */
export interface SnapshotComercial {
  tipo_cliente: TipoCliente;
  tramo_cantidad: string;
  margen_pct: number;
  precio_pre_extras: number;
  extras: Extra[];
  precio_unitario: number;
}

/**
 * Snapshot inmutable que se guarda en `lineas_presupuesto.detalle_calculo`
 * (CLAUDE.md sección 7.6). Genérico en `inputs` y `calculo` para que cada
 * técnica exponga sus propios campos con tipado fuerte.
 */
export interface DetalleCalculo<
  TInputs = Record<string, unknown>,
  TCalculo = Record<string, unknown>,
> {
  tecnica: CodigoTecnica;
  version_calculo: string;
  inputs: TInputs;
  parametros_aplicados: Record<string, number | string | boolean>;
  calculo: TCalculo;
  comercial: SnapshotComercial;
}

/** Resultado uniforme de cualquier función de cálculo. */
export interface CalculoResultado<
  TInputs = Record<string, unknown>,
  TCalculo = Record<string, unknown>,
> {
  /** Coste antes de aplicar margen comercial. */
  coste_interno: number;
  margen_aplicado_pct: number;
  /** Precio por unidad, sin IVA. Valor informativo/redondeado para el PDF. */
  precio_unitario: number;
  /**
   * Importe total de la línea, sin IVA y SIN extras (los extras van en líneas
   * aparte). Es el valor autoritativo: `precio_unitario * cantidad` puede
   * diferir en céntimos por el redondeo del unitario.
   */
  importe_linea: number;
  /** `true` si se tuvo que elevar el importe hasta el mínimo de trabajo. */
  aplicado_minimo: boolean;
  extras: Extra[];
  detalle_calculo: DetalleCalculo<TInputs, TCalculo>;
}
