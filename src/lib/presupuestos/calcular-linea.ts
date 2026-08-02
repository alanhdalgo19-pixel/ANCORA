// Puente entre Supabase y el motor de cálculo puro (CLAUDE.md sección 11:
// "Mantén las funciones de cálculo puras y testeables sin Supabase").
//
// Responsabilidad de este módulo: leer la configuración vigente de la base de
// datos, construir el objeto `config` que espera cada función pura, invocarla y
// devolver las filas listas para insertar en `lineas_presupuesto` más el
// preview que pinta el paso 5 del wizard. No escribe nada: eso lo hacen las
// Server Actions.

import {
  calcularBordado,
  calcularDTF,
  calcularImpresionDirecta,
  calcularSerigrafia,
  calcularSublimacion,
  componerDTF,
  redondear2,
  VERSION_CALCULO,
  type CalculoResultado,
  type CodigoPicaje,
  type DtfComposicionConfig,
  type Extra,
  type FilaTarifaSerigrafia,
  type LogoInput,
  type TramoMargen,
} from "@/lib/calculos";
import type { createClient } from "@/lib/supabase/server";
import type {
  Cliente,
  CodigoTecnica,
  ColorGrupo,
  Posicion,
  TipoCliente,
  TipoLinea,
} from "@/types/database";
import type {
  DatosLineaWizard,
  DetallesTecnica,
  ExtraSnapshot,
  LogoDTFWizard,
  PrendaSnapshot,
  PreviewComposicionDTF,
  PreviewLinea,
} from "@/types/presupuestos";
import { MAX_LOGOS_COMPOSICION } from "@/types/presupuestos";
import {
  NOMBRE_POSICION,
  subdescripcionLinea,
  subdescripcionPrenda,
  tituloLineaPrenda,
  tituloLineaTecnica,
} from "./descripciones";

type SupabaseServerClient = ReturnType<typeof createClient>;

/** Fila de `lineas_presupuesto` sin los campos que asigna la Server Action. */
export interface FilaLineaCalculada {
  tipo_linea: TipoLinea;
  prenda_id: string | null;
  tecnica_id: string | null;
  descripcion: string;
  cantidad: number;
  color: string | null;
  color_grupo: ColorGrupo | null;
  ancho_logo_cm: number | null;
  alto_logo_cm: number | null;
  posicion: Posicion | null;
  puntadas: number | null;
  num_colores: number | null;
  prenda_oscura: boolean | null;
  tipo_picaje_id: string | null;
  coste_interno: number;
  margen_aplicado_pct: number;
  precio_unitario: number;
  importe_linea: number;
  detalle_calculo: unknown;
}

export interface LineaCalculada {
  /** Venta de la prenda, si el usuario la añadió al presupuesto. */
  prenda: FilaLineaCalculada | null;
  /** Personalización: la línea que produce el motor de cálculo. */
  tecnica: FilaLineaCalculada;
  /** Picaje, fotolitos, vectorización, pantones. Cuelgan de `tecnica`. */
  extras: FilaLineaCalculada[];
  preview: PreviewLinea;
}

/** Error de negocio con mensaje ya redactado para Sonia. */
export class ErrorCalculo extends Error {}

/** PostgREST puede devolver `numeric` como string; normalizamos siempre. */
function num(valor: unknown, porDefecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

// ---------------------------------------------------------------------------
// Carga de configuración
// ---------------------------------------------------------------------------

async function cargarTecnicaId(
  supabase: SupabaseServerClient,
  codigo: CodigoTecnica,
): Promise<string> {
  const { data } = await supabase
    .from("tecnicas")
    .select("id")
    .eq("codigo", codigo)
    .single();

  if (!data) {
    throw new ErrorCalculo(
      `La técnica ${codigo} no está dada de alta en el sistema.`,
    );
  }
  return data.id as string;
}

async function cargarTramos(
  supabase: SupabaseServerClient,
  tecnicaId: string,
  tipoCliente: string,
): Promise<TramoMargen[]> {
  const { data } = await supabase
    .from("tramos_margen")
    .select("desde_cantidad, hasta_cantidad, margen_pct")
    .eq("tecnica_id", tecnicaId)
    .eq("tipo_cliente", tipoCliente)
    .order("desde_cantidad");

  return (data ?? []).map((fila) => ({
    desde: num(fila.desde_cantidad),
    hasta: fila.hasta_cantidad === null ? null : num(fila.hasta_cantidad),
    margen_pct: num(fila.margen_pct),
  }));
}

async function cargarTarifaSerigrafia(
  supabase: SupabaseServerClient,
  tipoCliente: string,
): Promise<FilaTarifaSerigrafia[]> {
  const { data } = await supabase
    .from("tarifas_serigrafia")
    .select("ubicacion, num_colores, desde_cantidad, hasta_cantidad, precio_unitario")
    .eq("tipo_cliente", tipoCliente);

  return (data ?? []).map((fila) => ({
    ubicacion: fila.ubicacion as "pecho" | "espalda",
    num_colores: num(fila.num_colores) === 2 ? 2 : 1,
    desde: num(fila.desde_cantidad),
    hasta: num(fila.hasta_cantidad),
    precio: num(fila.precio_unitario),
  }));
}

async function cargarFilaUnica(
  supabase: SupabaseServerClient,
  tabla: string,
  etiqueta: string,
): Promise<Record<string, unknown>> {
  const { data } = await supabase.from(tabla).select("*").limit(1).single();
  if (!data) {
    throw new ErrorCalculo(
      `No hay configuración de ${etiqueta} en el panel de administración.`,
    );
  }
  return data as Record<string, unknown>;
}

interface PicajeCargado {
  precios: Record<CodigoPicaje, number>;
  ids: Record<CodigoPicaje, string>;
}

async function cargarPicaje(
  supabase: SupabaseServerClient,
): Promise<PicajeCargado> {
  const { data } = await supabase
    .from("tipos_picaje")
    .select("id, codigo, precio_base");

  const precios = {} as Record<CodigoPicaje, number>;
  const ids = {} as Record<CodigoPicaje, string>;
  for (const fila of data ?? []) {
    precios[fila.codigo as CodigoPicaje] = num(fila.precio_base);
    ids[fila.codigo as CodigoPicaje] = fila.id as string;
  }
  return { precios, ids };
}

// ---------------------------------------------------------------------------
// DTF: motor simple vs. composición (Prompt 8)
// ---------------------------------------------------------------------------

/**
 * Configuración del rollo, común a `calcularDTF` y a `componerDTF`: los dos
 * tipos coinciden campo a campo (ver `DtfComposicionConfig` en el motor).
 */
function construirConfigDTF(
  params: Record<string, unknown>,
  tramos: TramoMargen[],
): DtfComposicionConfig {
  return {
    ancho_rollo_cm: num(params.ancho_rollo_cm),
    precio_metro: num(params.precio_metro),
    recorte_por_logo: num(params.recorte_por_logo),
    mano_obra_por_minuto: num(params.mano_obra_por_minuto),
    preparacion_pct: num(params.preparacion_pct),
    minimo_trabajo: num(params.minimo_trabajo),
    margen_seguridad_cm: num(params.margen_seguridad_cm),
    minutos_setup_fijo: num(params.minutos_setup_fijo),
    minutos_por_logo: num(params.minutos_por_logo),
    tramos_margen: tramos,
  };
}

/** Ancho realmente aprovechable del rollo: hay margen en los dos bordes. */
function anchoUtilRollo(config: DtfComposicionConfig): number {
  return config.ancho_rollo_cm - 2 * config.margen_seguridad_cm;
}

/**
 * Orientación con la que se coloca un logo suelto en el rollo.
 *
 * Réplica del criterio de `componerDTF` (dejar la dimensión mayor en
 * horizontal, porque el rollo se paga por metro lineal), necesaria aquí porque
 * `calcularDTF` no conoce el concepto de logo rotable y no se toca: recibe ya
 * las medidas aplicadas. Si ninguna orientación cabe, devuelve la preferida y
 * deja que el motor lance su propio error.
 */
function orientarLogo(
  logo: LogoDTFWizard,
  anchoUtil: number,
): { ancho: number; alto: number; rotado: boolean } {
  const sinRotar = { ancho: logo.ancho_cm, alto: logo.alto_cm, rotado: false };
  if (!logo.rotable) return sinRotar;

  const rotado = { ancho: logo.alto_cm, alto: logo.ancho_cm, rotado: true };
  const preferida = logo.alto_cm > logo.ancho_cm ? rotado : sinRotar;
  const alternativa = preferida === rotado ? sinRotar : rotado;

  if (preferida.ancho <= anchoUtil) return preferida;
  if (alternativa.ancho <= anchoUtil) return alternativa;
  return preferida;
}

/**
 * Bloque que el puente añade al snapshot del motor con los logos TAL COMO los
 * escribió Sonia.
 *
 * El motor no guarda la posición (para el bin packing es irrelevante) ni las
 * medidas sin rotar, y las dos cosas hacen falta luego: la posición para las
 * sub-líneas del PDF y las medidas originales para reeditar la línea. Es un
 * añadido al snapshot, no una sustitución: `inputs`, `calculo`, `comercial` y
 * `layout` siguen siendo los que devolvió el motor.
 */
interface BloqueWizardDTF {
  cantidad_prendas: number;
  incluir_vectorizacion: boolean;
  logos: LogoDTFWizard[];
}

function bloqueWizardDTF(
  detalles: Extract<DetallesTecnica, { tecnica: "DTF" }>,
  cantidad: number,
): BloqueWizardDTF {
  return {
    cantidad_prendas: cantidad,
    incluir_vectorizacion: detalles.incluir_vectorizacion,
    logos: detalles.logos.map((logo) => ({ ...logo })),
  };
}

/** Valida la lista de logos antes de bajar al motor. */
function validarLogos(logos: LogoDTFWizard[]): void {
  if (logos.length === 0) {
    throw new ErrorCalculo("Añade al menos un logo a la línea de DTF.");
  }
  if (logos.length > MAX_LOGOS_COMPOSICION) {
    throw new ErrorCalculo(
      `Una línea de DTF admite como máximo ${MAX_LOGOS_COMPOSICION} logos. Reparte el trabajo en varias líneas.`,
    );
  }
}

/**
 * Traduce los logos del wizard a los `LogoInput` del bin packing.
 *
 * Cada logo se estampa sobre TODAS las prendas, así que su cantidad es la
 * cantidad de prendas: 120 polos con 2 logos son 240 unidades en el rollo.
 */
function aLogosInput(
  logos: LogoDTFWizard[],
  cantidadPrendas: number,
): LogoInput[] {
  return logos.map((logo, indice) => ({
    id: `logo-${indice + 1}`,
    nombre: `Logo ${NOMBRE_POSICION[logo.posicion].toLowerCase()}`,
    ancho_cm: logo.ancho_cm,
    alto_cm: logo.alto_cm,
    cantidad: cantidadPrendas,
    rotable: logo.rotable,
  }));
}

/** Extra de vectorización, que en composición no genera el motor. */
function extraVectorizacion(precio: number): Extra {
  if (!Number.isFinite(precio) || precio < 0) {
    throw new ErrorCalculo(
      "Falta el precio de vectorización en Admin → Serigrafía.",
    );
  }
  return { descripcion: "Vectorización", importe: redondear2(precio) };
}

// ---------------------------------------------------------------------------
// Cálculo de la línea de técnica
// ---------------------------------------------------------------------------

type ResultadoGenerico = CalculoResultado<unknown, unknown>;

/**
 * Forma común a las dos familias de motor. `componerDTF` no devuelve un
 * `CalculoResultado` (su snapshot tiene bloques propios y su comercial no
 * lleva unitario ni extras), así que ambos resultados se normalizan aquí y el
 * resto del puente ya no distingue.
 */
interface ResultadoTecnica {
  coste_interno: number;
  margen_aplicado_pct: number;
  precio_unitario: number;
  importe_linea: number;
  aplicado_minimo: boolean;
  extras: Extra[];
  tramo_cantidad: string;
  detalle_calculo: unknown;
  /** Avisos no bloqueantes: hoy solo los produce el bin packing. */
  warnings: string[];
}

function normalizar(resultado: ResultadoGenerico): ResultadoTecnica {
  return {
    coste_interno: resultado.coste_interno,
    margen_aplicado_pct: resultado.margen_aplicado_pct,
    precio_unitario: resultado.precio_unitario,
    importe_linea: resultado.importe_linea,
    aplicado_minimo: resultado.aplicado_minimo,
    extras: resultado.extras,
    tramo_cantidad: resultado.detalle_calculo.comercial.tramo_cantidad,
    detalle_calculo: resultado.detalle_calculo,
    warnings: [],
  };
}

/**
 * Resuelve la línea de DTF eligiendo motor según el número de logos:
 * uno → `calcularDTF` (comportamiento de siempre, snapshot `DTF`);
 * dos o más → `componerDTF` (bin packing, snapshot `DTF_COMPOSICION`).
 */
function calcularLineaDTF(
  detalles: Extract<DetallesTecnica, { tecnica: "DTF" }>,
  cantidad: number,
  tipoCliente: TipoCliente,
  config: DtfComposicionConfig,
  precioVectorizacion: number,
): ResultadoTecnica {
  validarLogos(detalles.logos);
  const wizard = bloqueWizardDTF(detalles, cantidad);

  if (detalles.logos.length === 1) {
    const logo = detalles.logos[0];
    const orientacion = orientarLogo(logo, anchoUtilRollo(config));

    const resultado = calcularDTF(
      {
        cantidad,
        ancho_logo_cm: orientacion.ancho,
        alto_logo_cm: orientacion.alto,
        posicion: logo.posicion,
        tipo_cliente: tipoCliente,
        incluir_vectorizacion: detalles.incluir_vectorizacion,
        precio_vectorizacion: precioVectorizacion,
      },
      config,
    );

    const normalizado = normalizar(resultado);
    return {
      ...normalizado,
      detalle_calculo: { ...resultado.detalle_calculo, wizard },
    };
  }

  const composicion = componerDTF(
    aLogosInput(detalles.logos, cantidad),
    config,
  );

  const extras = detalles.incluir_vectorizacion
    ? [extraVectorizacion(precioVectorizacion)]
    : [];

  return {
    coste_interno: composicion.coste_interno,
    margen_aplicado_pct: composicion.margen_aplicado_pct,
    // El unitario que se imprime es POR PRENDA, no por logo: en el PDF la
    // cantidad de la línea son las 120 prendas, no los 240 logos.
    precio_unitario: redondear2(composicion.precio_total / cantidad),
    importe_linea: composicion.precio_total,
    aplicado_minimo: composicion.aplicado_minimo,
    extras,
    tramo_cantidad: composicion.detalle_calculo.comercial.tramo_cantidad,
    detalle_calculo: { ...composicion.detalle_calculo, wizard },
    warnings: composicion.warnings,
  };
}

async function calcularTecnica(
  supabase: SupabaseServerClient,
  detalles: DetallesTecnica,
  cantidad: number,
  cliente: Pick<Cliente, "tipo_cliente" | "descuento_bordado_pct">,
): Promise<{
  resultado: ResultadoTecnica;
  tecnicaId: string;
  picajeId: string | null;
}> {
  const tipoCliente = cliente.tipo_cliente;
  const tecnicaId = await cargarTecnicaId(supabase, detalles.tecnica);
  const tramos = await cargarTramos(supabase, tecnicaId, tipoCliente);

  switch (detalles.tecnica) {
    case "DTF": {
      const [params, paramsSerigrafia] = await Promise.all([
        cargarFilaUnica(supabase, "parametros_dtf", "DTF"),
        cargarFilaUnica(supabase, "parametros_serigrafia", "serigrafía"),
      ]);

      const resultado = calcularLineaDTF(
        detalles,
        cantidad,
        tipoCliente,
        construirConfigDTF(params, tramos),
        num(paramsSerigrafia.vectorizacion),
      );
      return { resultado, tecnicaId, picajeId: null };
    }

    case "BORDADO": {
      const [params, picaje] = await Promise.all([
        cargarFilaUnica(supabase, "parametros_bordado", "bordado"),
        cargarPicaje(supabase),
      ]);

      const resultado = calcularBordado(
        {
          cantidad,
          puntadas: detalles.puntadas,
          tarifa_seleccionada: detalles.tarifa,
          precio_personalizado: detalles.precio_personalizado ?? undefined,
          posicion: detalles.posicion,
          tipo_cliente: tipoCliente,
          descuento_habitual_pct: num(cliente.descuento_bordado_pct),
          trabajo_nuevo: detalles.trabajo_nuevo,
          tipo_picaje: detalles.tipo_picaje ?? undefined,
          precio_picaje_personalizado:
            detalles.precio_picaje_personalizado ?? undefined,
        },
        {
          precio_tarifa_1: num(params.precio_tarifa_1),
          precio_tarifa_2: num(params.precio_tarifa_2),
          precio_tarifa_3: num(params.precio_tarifa_3),
          precio_personalizable_default: num(
            params.precio_personalizable_default,
          ),
          unidad_medida:
            params.unidad_medida as "por_puntada" | "por_100_puntadas" | "por_1000_puntadas",
          minimo_pieza: num(params.minimo_pieza),
          minimo_trabajo: num(params.minimo_trabajo),
          precios_picaje: picaje.precios,
          tramos_margen: tramos,
        },
      );

      const picajeId =
        detalles.trabajo_nuevo && detalles.tipo_picaje
          ? (picaje.ids[detalles.tipo_picaje] ?? null)
          : null;

      return { resultado: normalizar(resultado), tecnicaId, picajeId };
    }

    case "SERIGRAFIA": {
      const [params, tarifa] = await Promise.all([
        cargarFilaUnica(supabase, "parametros_serigrafia", "serigrafía"),
        cargarTarifaSerigrafia(supabase, tipoCliente),
      ]);

      const resultado = calcularSerigrafia(
        {
          cantidad,
          num_colores: detalles.num_colores,
          ubicacion: detalles.ubicacion,
          prenda_oscura: detalles.prenda_oscura,
          tipo_cliente: tipoCliente,
          trabajo_nuevo: detalles.trabajo_nuevo,
          incluir_vectorizacion: detalles.incluir_vectorizacion,
          incluir_pantone: detalles.incluir_pantone,
          cantidad_pantones: detalles.cantidad_pantones ?? undefined,
        },
        {
          tarifa,
          recargo_oscura_pecho_por_color: num(
            params.recargo_oscura_pecho_por_color,
          ),
          recargo_oscura_espalda_por_color: num(
            params.recargo_oscura_espalda_por_color,
          ),
          fotolito_pecho: num(params.fotolito_pecho),
          fotolito_espalda: num(params.fotolito_espalda),
          minimo_trabajo: num(params.minimo_trabajo),
          pantone_por_color: num(params.pantone_por_color),
          vectorizacion: num(params.vectorizacion),
          tramos_margen: tramos,
        },
      );
      return { resultado: normalizar(resultado), tecnicaId, picajeId: null };
    }

    case "IMPRESION_DIRECTA": {
      const [params, paramsSerigrafia, tarifa] = await Promise.all([
        cargarFilaUnica(
          supabase,
          "parametros_impresion_directa",
          "impresión directa",
        ),
        cargarFilaUnica(supabase, "parametros_serigrafia", "serigrafía"),
        cargarTarifaSerigrafia(supabase, tipoCliente),
      ]);

      const resultado = calcularImpresionDirecta(
        {
          cantidad,
          num_colores: detalles.num_colores,
          ubicacion: detalles.ubicacion,
          prenda_oscura: detalles.prenda_oscura,
          tipo_cliente: tipoCliente,
          incluir_vectorizacion: detalles.incluir_vectorizacion,
        },
        {
          tarifa,
          recargo_oscura_pecho_por_color: num(
            paramsSerigrafia.recargo_oscura_pecho_por_color,
          ),
          recargo_oscura_espalda_por_color: num(
            paramsSerigrafia.recargo_oscura_espalda_por_color,
          ),
          minimo_trabajo: num(params.minimo_trabajo),
          vectorizacion: num(paramsSerigrafia.vectorizacion),
          tramos_margen: tramos,
        },
      );
      return { resultado: normalizar(resultado), tecnicaId, picajeId: null };
    }

    case "SUBLIMACION": {
      const params = await cargarFilaUnica(
        supabase,
        "parametros_sublimacion",
        "sublimación",
      );

      const resultado = calcularSublimacion(
        {
          cantidad,
          posicion: detalles.posicion,
          tipo_cliente: tipoCliente,
        },
        {
          precio_unitario_base: num(params.precio_unitario_base),
          cantidad_minima: num(params.cantidad_minima, 1),
          tasa_merma_pct: num(params.tasa_merma_pct),
          solo_blanco_poliester: params.solo_blanco_poliester === true,
          // Sublimación no tiene mínimo propio en el esquema; se usa el de DTF
          // por consistencia hasta que Espe defina la tarifa (CLAUDE.md 10.5).
          minimo_trabajo: 15,
          tramos_margen: tramos,
        },
      );
      return { resultado: normalizar(resultado), tecnicaId, picajeId: null };
    }
  }
}

// ---------------------------------------------------------------------------
// Línea de venta de prenda
// ---------------------------------------------------------------------------

interface PrendaCalculada {
  fila: FilaLineaCalculada;
  sin_precio: boolean;
}

async function calcularLineaPrenda(
  supabase: SupabaseServerClient,
  prendaId: string,
  cantidad: number,
  color: string | null,
  colorGrupo: ColorGrupo,
  tipoCliente: string,
): Promise<PrendaCalculada> {
  const { data: prenda } = await supabase
    .from("prendas")
    .select("id, nombre, codigo_interno")
    .eq("id", prendaId)
    .single();

  if (!prenda) {
    throw new ErrorCalculo("La prenda seleccionada ya no está disponible.");
  }

  const { data: precios } = await supabase
    .from("precios_prenda")
    .select("desde_cantidad, hasta_cantidad, precio")
    .eq("prenda_id", prendaId)
    .eq("color_grupo", colorGrupo)
    .eq("tipo_cliente", tipoCliente);

  const fila = (precios ?? []).find(
    (p) =>
      cantidad >= num(p.desde_cantidad) &&
      (p.hasta_cantidad === null || cantidad <= num(p.hasta_cantidad)),
  );

  if (!fila) {
    throw new ErrorCalculo(
      `No hay precio configurado para "${prenda.nombre}" en color ${colorGrupo} y ${cantidad} unidades. Configúralo en Admin → Prendas antes de presupuestarla.`,
    );
  }

  const precioUnitario = num(fila.precio);
  const importe = Math.round(precioUnitario * cantidad * 100) / 100;
  const tramo =
    fila.hasta_cantidad === null
      ? `${num(fila.desde_cantidad)}+`
      : `${num(fila.desde_cantidad)}-${num(fila.hasta_cantidad)}`;

  const snapshot: PrendaSnapshot = {
    tipo: "PRENDA",
    version_calculo: VERSION_CALCULO,
    inputs: {
      prenda_id: prendaId,
      cantidad,
      color,
      color_grupo: colorGrupo,
      tipo_cliente: tipoCliente,
    },
    calculo: {
      precio_unitario: precioUnitario,
      tramo_cantidad: tramo,
      importe_linea: importe,
    },
  };

  return {
    sin_precio: precioUnitario === 0,
    fila: {
      tipo_linea: "prenda",
      prenda_id: prendaId,
      tecnica_id: null,
      descripcion: tituloLineaPrenda(prenda.nombre as string, color),
      cantidad,
      color,
      color_grupo: colorGrupo,
      ancho_logo_cm: null,
      alto_logo_cm: null,
      posicion: null,
      puntadas: null,
      num_colores: null,
      prenda_oscura: null,
      tipo_picaje_id: null,
      coste_interno: importe,
      margen_aplicado_pct: 0,
      precio_unitario: precioUnitario,
      importe_linea: importe,
      detalle_calculo: snapshot,
    },
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Calcula todas las filas que genera un paso del wizard: la venta de prenda
 * (opcional), la línea de técnica y sus extras. No guarda nada.
 *
 * Lanza `ErrorCalculo` con un mensaje ya redactado en español cuando el motor
 * o la configuración impiden presupuestar (logo demasiado ancho, tarifa sin
 * configurar, más de 2 colores…).
 */
export async function calcularLinea(
  supabase: SupabaseServerClient,
  datos: DatosLineaWizard,
  cliente: Pick<Cliente, "tipo_cliente" | "descuento_bordado_pct">,
): Promise<LineaCalculada> {
  if (!Number.isInteger(datos.cantidad) || datos.cantidad <= 0) {
    throw new ErrorCalculo("La cantidad debe ser un número entero mayor que cero.");
  }

  let prendaCalculada: PrendaCalculada | null = null;
  let nombrePrenda: string | null = null;

  if (datos.prenda_id) {
    if (!datos.color_grupo) {
      throw new ErrorCalculo("Falta el grupo de color de la prenda.");
    }
    prendaCalculada = await calcularLineaPrenda(
      supabase,
      datos.prenda_id,
      datos.cantidad,
      datos.color,
      datos.color_grupo,
      cliente.tipo_cliente,
    );
    nombrePrenda = prendaCalculada.fila.descripcion;
  }

  let calculo;
  try {
    calculo = await calcularTecnica(
      supabase,
      datos.detalles,
      datos.cantidad,
      cliente,
    );
  } catch (error) {
    if (error instanceof ErrorCalculo) throw error;
    throw new ErrorCalculo(
      error instanceof Error
        ? error.message
        : "No se ha podido calcular la línea.",
    );
  }

  const { resultado, tecnicaId, picajeId } = calculo;
  const detalles = datos.detalles;

  // En una composición DTF no hay una posición ni unas medidas únicas: las
  // columnas guardan las del primer logo (útiles para filtrar e informar) y el
  // detalle completo de todos vive en el snapshot.
  const primerLogo =
    detalles.tecnica === "DTF" ? (detalles.logos[0] ?? null) : null;

  const posicion: Posicion =
    detalles.tecnica === "DTF"
      ? (primerLogo?.posicion ?? "pecho")
      : "posicion" in detalles
        ? detalles.posicion
        : detalles.ubicacion;

  const filaTecnica: FilaLineaCalculada = {
    tipo_linea: "tecnica",
    prenda_id: datos.prenda_id,
    tecnica_id: tecnicaId,
    descripcion: tituloLineaTecnica(detalles, nombrePrenda),
    cantidad: datos.cantidad,
    color: datos.color,
    color_grupo: datos.color_grupo,
    ancho_logo_cm: primerLogo
      ? primerLogo.ancho_cm
      : "ancho_logo_cm" in detalles
        ? (detalles.ancho_logo_cm ?? null)
        : null,
    alto_logo_cm: primerLogo
      ? primerLogo.alto_cm
      : "alto_logo_cm" in detalles
        ? (detalles.alto_logo_cm ?? null)
        : null,
    posicion,
    puntadas: "puntadas" in detalles ? detalles.puntadas : null,
    num_colores: "num_colores" in detalles ? detalles.num_colores : null,
    prenda_oscura: "prenda_oscura" in detalles ? detalles.prenda_oscura : null,
    tipo_picaje_id: picajeId,
    coste_interno: resultado.coste_interno,
    margen_aplicado_pct: resultado.margen_aplicado_pct,
    precio_unitario: resultado.precio_unitario,
    importe_linea: resultado.importe_linea,
    detalle_calculo: resultado.detalle_calculo,
  };

  // Los extras van en líneas propias (CLAUDE.md 7.3 PASO 6 y 7.4 PASO 5).
  // El picaje conserva su `tipo_picaje_id` para poder reconstruirlo después.
  const filasExtras: FilaLineaCalculada[] = resultado.extras.map((extra) => {
    const esPicaje = extra.descripcion.startsWith("Picaje");
    const snapshot: ExtraSnapshot = {
      tipo: "EXTRA",
      version_calculo: VERSION_CALCULO,
      origen: detalles.tecnica,
      descripcion: extra.descripcion,
      importe: extra.importe,
    };
    return {
      tipo_linea: "extra",
      prenda_id: null,
      tecnica_id: tecnicaId,
      descripcion: extra.descripcion,
      cantidad: 1,
      color: null,
      color_grupo: null,
      ancho_logo_cm: null,
      alto_logo_cm: null,
      posicion: null,
      puntadas: null,
      num_colores: null,
      prenda_oscura: null,
      tipo_picaje_id: esPicaje ? picajeId : null,
      coste_interno: extra.importe,
      margen_aplicado_pct: 0,
      precio_unitario: extra.importe,
      importe_linea: extra.importe,
      detalle_calculo: snapshot,
    };
  });

  const total =
    (prendaCalculada?.fila.importe_linea ?? 0) +
    filaTecnica.importe_linea +
    filasExtras.reduce((suma, extra) => suma + extra.importe_linea, 0);

  const preview: PreviewLinea = {
    prenda: prendaCalculada
      ? {
          descripcion: prendaCalculada.fila.descripcion,
          detalle: subdescripcionPrenda(prendaCalculada.fila.detalle_calculo),
          cantidad: prendaCalculada.fila.cantidad,
          precio_unitario: prendaCalculada.fila.precio_unitario,
          importe: prendaCalculada.fila.importe_linea,
        }
      : null,
    prenda_sin_precio: prendaCalculada?.sin_precio ?? false,
    tecnica: {
      descripcion: filaTecnica.descripcion,
      detalle: subdescripcionLinea(filaTecnica.detalle_calculo),
      cantidad: filaTecnica.cantidad,
      precio_unitario: filaTecnica.precio_unitario,
      importe: filaTecnica.importe_linea,
    },
    extras: filasExtras.map((extra) => ({
      descripcion: extra.descripcion,
      detalle: null,
      cantidad: 1,
      precio_unitario: extra.precio_unitario,
      importe: extra.importe_linea,
    })),
    warnings: resultado.warnings,
    desglose: {
      coste_interno: resultado.coste_interno,
      margen_pct: resultado.margen_aplicado_pct,
      aplicado_minimo: resultado.aplicado_minimo,
      tramo_cantidad: resultado.tramo_cantidad,
    },
    total: Math.round(total * 100) / 100,
  };

  return {
    prenda: prendaCalculada?.fila ?? null,
    tecnica: filaTecnica,
    extras: filasExtras,
    preview,
  };
}

/**
 * Cálculo en vivo del bloque de logos del paso 4 (Prompt 8, parte B.4).
 *
 * Se llama con cada cambio del formulario (con debounce), así que solo resuelve
 * la técnica: ni carga la prenda ni monta los extras. Usa exactamente el mismo
 * camino que `calcularLinea`, de modo que lo que Sonia ve mientras teclea es lo
 * que se guardará al confirmar.
 */
export async function previsualizarDTF(
  supabase: SupabaseServerClient,
  logos: LogoDTFWizard[],
  cantidad: number,
  tipoCliente: TipoCliente,
): Promise<PreviewComposicionDTF> {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new ErrorCalculo("La cantidad debe ser un número entero mayor que cero.");
  }
  validarLogos(logos);

  const tecnicaId = await cargarTecnicaId(supabase, "DTF");
  const [tramos, params, paramsSerigrafia] = await Promise.all([
    cargarTramos(supabase, tecnicaId, tipoCliente),
    cargarFilaUnica(supabase, "parametros_dtf", "DTF"),
    cargarFilaUnica(supabase, "parametros_serigrafia", "serigrafía"),
  ]);

  const resultado = calcularLineaDTF(
    { tecnica: "DTF", logos, incluir_vectorizacion: false },
    cantidad,
    tipoCliente,
    construirConfigDTF(params, tramos),
    num(paramsSerigrafia.vectorizacion),
  );

  const snapshot = resultado.detalle_calculo as {
    tecnica: string;
    calculo?: { metros_necesarios?: number };
    composicion?: { metros_necesarios?: number; eficiencia_pct?: number };
  };
  const esComposicion = snapshot.tecnica === "DTF_COMPOSICION";
  const cantidadTotalLogos = logos.length * cantidad;

  return {
    modo: esComposicion ? "DTF_COMPOSICION" : "DTF",
    cantidad_total_logos: cantidadTotalLogos,
    metros_necesarios: esComposicion
      ? num(snapshot.composicion?.metros_necesarios)
      : num(snapshot.calculo?.metros_necesarios),
    // El motor simple no mide aprovechamiento: solo lo sabe el bin packing.
    eficiencia_pct: esComposicion
      ? num(snapshot.composicion?.eficiencia_pct)
      : null,
    coste_interno: resultado.coste_interno,
    margen_aplicado_pct: resultado.margen_aplicado_pct,
    precio_total: resultado.importe_linea,
    precio_promedio_por_logo: redondear2(
      resultado.importe_linea / cantidadTotalLogos,
    ),
    precio_por_prenda: resultado.precio_unitario,
    aplicado_minimo: resultado.aplicado_minimo,
    warnings: resultado.warnings,
  };
}
