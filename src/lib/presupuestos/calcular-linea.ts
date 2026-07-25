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
  VERSION_CALCULO,
  type CalculoResultado,
  type CodigoPicaje,
  type FilaTarifaSerigrafia,
  type TramoMargen,
} from "@/lib/calculos";
import type { createClient } from "@/lib/supabase/server";
import type {
  Cliente,
  CodigoTecnica,
  ColorGrupo,
  Posicion,
  TipoLinea,
} from "@/types/database";
import type {
  DatosLineaWizard,
  DetallesTecnica,
  ExtraSnapshot,
  PrendaSnapshot,
  PreviewLinea,
} from "@/types/presupuestos";
import {
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
// Cálculo de la línea de técnica
// ---------------------------------------------------------------------------

type ResultadoGenerico = CalculoResultado<unknown, unknown>;

async function calcularTecnica(
  supabase: SupabaseServerClient,
  detalles: DetallesTecnica,
  cantidad: number,
  cliente: Pick<Cliente, "tipo_cliente" | "descuento_bordado_pct">,
): Promise<{
  resultado: ResultadoGenerico;
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

      const resultado = calcularDTF(
        {
          cantidad,
          ancho_logo_cm: detalles.ancho_logo_cm,
          alto_logo_cm: detalles.alto_logo_cm,
          posicion: detalles.posicion,
          tipo_cliente: tipoCliente,
          incluir_vectorizacion: detalles.incluir_vectorizacion,
          precio_vectorizacion: num(paramsSerigrafia.vectorizacion),
        },
        {
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
        },
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

      return { resultado, tecnicaId, picajeId };
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
      return { resultado, tecnicaId, picajeId: null };
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
      return { resultado, tecnicaId, picajeId: null };
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
      return { resultado, tecnicaId, picajeId: null };
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
  const posicion: Posicion =
    "posicion" in detalles ? detalles.posicion : detalles.ubicacion;

  const filaTecnica: FilaLineaCalculada = {
    tipo_linea: "tecnica",
    prenda_id: datos.prenda_id,
    tecnica_id: tecnicaId,
    descripcion: tituloLineaTecnica(detalles, nombrePrenda),
    cantidad: datos.cantidad,
    color: datos.color,
    color_grupo: datos.color_grupo,
    ancho_logo_cm:
      "ancho_logo_cm" in detalles ? (detalles.ancho_logo_cm ?? null) : null,
    alto_logo_cm:
      "alto_logo_cm" in detalles ? (detalles.alto_logo_cm ?? null) : null,
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

  const comercial = resultado.detalle_calculo.comercial;

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
    desglose: {
      coste_interno: resultado.coste_interno,
      margen_pct: resultado.margen_aplicado_pct,
      aplicado_minimo: resultado.aplicado_minimo,
      tramo_cantidad: comercial.tramo_cantidad,
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
