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

// ---------------------------------------------------------------------------
// Composición DTF (bin packing 2D de varios logos en el mismo rollo).
// Ver `composicion-dtf.ts`. Es un módulo independiente de `calcularDTF`.
// ---------------------------------------------------------------------------

/**
 * Input de un logo individual en la composición DTF.
 * Cada logo puede repetirse `cantidad` veces en el rollo.
 */
export interface LogoInput {
  /** Identificador único dentro de la composición; se referencia en el layout. */
  id: string;
  /** Opcional, para trazabilidad ("Doyle Náutica pecho"). */
  nombre?: string;
  /** Ancho del logo tal como se estampará. */
  ancho_cm: number;
  /** Alto del logo tal como se estampará. */
  alto_cm: number;
  /** Cuántas veces se estampa este logo. */
  cantidad: number;
  /** Si es `true`, el algoritmo puede colocarlo rotado 90°. */
  rotable: boolean;
}

/**
 * Configuración de la composición DTF. Coincide campo a campo con `DtfConfig`
 * pero se declara aparte para que el cálculo simple y el compuesto puedan
 * evolucionar por separado.
 */
export interface DtfComposicionConfig {
  ancho_rollo_cm: number;
  precio_metro: number;
  recorte_por_logo: number;
  mano_obra_por_minuto: number;
  preparacion_pct: number;
  minimo_trabajo: number;
  margen_seguridad_cm: number;
  minutos_setup_fijo: number;
  minutos_por_logo: number;
  /** Tramos ya filtrados por técnica DTF y tipo de cliente. */
  tramos_margen: TramoMargen[];
}

/**
 * Posición final de un logo dentro del rollo.
 * (0, 0) es la esquina superior izquierda. El eje Y crece hacia abajo: el
 * rollo se va "consumiendo" a lo largo.
 */
export interface LogoColocado {
  /** Referencia al `LogoInput.id` original. */
  logo_id: string;
  nombre?: string;
  x_cm: number;
  /** Distancia desde el inicio del rollo. */
  y_cm: number;
  /** Ancho aplicado: el original o el rotado. */
  ancho_cm: number;
  /** Alto aplicado: el original o el rotado. */
  alto_cm: number;
  rotado: boolean;
}

/** Bloque `composicion` del snapshot: cómo se resolvió el empaquetado. */
export interface SnapshotComposicion {
  algoritmo: "shelf_ffd";
  num_estanterias: number;
  metros_necesarios: number;
  eficiencia_pct: number;
  altura_consumida_cm: number;
}

/** Bloque `calculo` del snapshot de composición. */
export interface ComposicionDetalleCalculo {
  material: number;
  recorte: number;
  minutos_estimados: number;
  mano_obra: number;
  subtotal_sin_preparacion: number;
  preparacion: number;
  coste_interno: number;
  aplicado_minimo: boolean;
}

/** Bloque `comercial` del snapshot de composición. */
export interface SnapshotComercialComposicion {
  tramo_cantidad: string;
  margen_pct: number;
  precio_total: number;
  precio_promedio_por_logo: number;
}

/**
 * Snapshot inmutable de la composición, para
 * `lineas_presupuesto.detalle_calculo`.
 *
 * No reutiliza `DetalleCalculo` porque la composición añade dos bloques
 * propios (`composicion` y `layout`), su `comercial` no tiene unitario ni
 * extras, y su `tecnica` ("DTF_COMPOSICION") no es un `CodigoTecnica` del
 * esquema: es un modo de cálculo dentro de la técnica DTF.
 */
export interface ComposicionSnapshot {
  tecnica: "DTF_COMPOSICION";
  version_calculo: string;
  inputs: {
    logos: LogoInput[];
    cantidad_total: number;
  };
  parametros_aplicados: Record<string, number>;
  composicion: SnapshotComposicion;
  calculo: ComposicionDetalleCalculo;
  comercial: SnapshotComercialComposicion;
  layout: LogoColocado[];
}

/** Resultado de la composición DTF. */
export interface ComposicionResultado {
  /** Suma de las cantidades de todos los logos. */
  cantidad_total_logos: number;
  /** Metros de rollo consumidos. */
  metros_necesarios: number;
  /** Porcentaje del área del rollo realmente aprovechada. */
  eficiencia_pct: number;

  coste_material: number;
  coste_recorte: number;
  coste_mano_obra: number;
  minutos_estimados: number;
  /** Ya con preparación y mínimo de trabajo aplicados. */
  coste_interno: number;
  aplicado_minimo: boolean;

  margen_aplicado_pct: number;
  /** Precio final del compuesto, sin IVA. Valor autoritativo. */
  precio_total: number;
  /** `precio_total / cantidad_total_logos`, informativo para el PDF. */
  precio_promedio_por_logo: number;

  /** Cada logo en su posición final dentro del rollo. */
  layout: LogoColocado[];

  /** Avisos no bloqueantes para la UI del wizard. */
  warnings: string[];

  detalle_calculo: ComposicionSnapshot;
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
