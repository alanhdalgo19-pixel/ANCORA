// Carga de datos que necesita el wizard en el servidor: catálogo de prendas,
// parámetros de las técnicas y reconstrucción de una línea ya guardada para
// poder editarla.

import type { createClient } from "@/lib/supabase/server";
import type { PrendaOpcion } from "@/components/presupuestos/SelectorPrenda";
import type {
  CodigoPicaje,
  ColorGrupo,
  Posicion,
  UnidadMedidaBordado,
} from "@/types/database";
import type {
  DatosLineaWizard,
  DetallesTecnica,
  LogoDTFWizard,
  ParametrosWizard,
} from "@/types/presupuestos";
import type { TarifaBordado } from "@/lib/calculos";

type SupabaseServerClient = ReturnType<typeof createClient>;

function num(valor: unknown, porDefecto = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

/** Catálogo de prendas activas con el nombre de su proveedor. */
export async function cargarPrendas(
  supabase: SupabaseServerClient,
): Promise<PrendaOpcion[]> {
  const { data } = await supabase
    .from("prendas")
    .select(
      "id, codigo_interno, nombre, proveedor_id, disponible_oscuro, proveedores(nombre)",
    )
    .eq("activo", true)
    .order("nombre");

  return (data ?? []).map((fila) => {
    // La relación llega como objeto (many-to-one) pero PostgREST puede
    // devolverla envuelta en array según la versión; se cubren ambos casos.
    const proveedor = Array.isArray(fila.proveedores)
      ? fila.proveedores[0]
      : fila.proveedores;

    return {
      id: fila.id as string,
      codigo_interno: fila.codigo_interno as string,
      nombre: fila.nombre as string,
      proveedor_id: fila.proveedor_id as string,
      proveedor_nombre:
        (proveedor as { nombre?: string } | null)?.nombre ?? "Sin proveedor",
      disponible_oscuro: fila.disponible_oscuro === true,
    };
  });
}

/** Importes y tarifas que el paso 4 muestra en pantalla. */
export async function cargarParametrosWizard(
  supabase: SupabaseServerClient,
): Promise<ParametrosWizard> {
  const [serigrafia, bordado, sublimacion, dtf, picajes] = await Promise.all([
    supabase.from("parametros_serigrafia").select("*").limit(1).maybeSingle(),
    supabase.from("parametros_bordado").select("*").limit(1).maybeSingle(),
    supabase.from("parametros_sublimacion").select("*").limit(1).maybeSingle(),
    supabase
      .from("parametros_dtf")
      .select("ancho_rollo_cm, margen_seguridad_cm")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tipos_picaje")
      .select("codigo, nombre, precio_base, editable_en_presupuesto"),
  ]);

  // Orden de complejidad creciente. No se puede ordenar por `precio_base`
  // porque PERSONALIZADO cuesta 45 € y quedaría entre SENCILLO y MEDIO.
  const ORDEN_PICAJE: CodigoPicaje[] = [
    "SENCILLO",
    "MEDIO",
    "COMPLEJO",
    "PERSONALIZADO",
  ];

  return {
    vectorizacion: num(serigrafia.data?.vectorizacion),
    fotolito_pecho: num(serigrafia.data?.fotolito_pecho),
    fotolito_espalda: num(serigrafia.data?.fotolito_espalda),
    pantone_por_color: num(serigrafia.data?.pantone_por_color),
    // Valores de la semilla como respaldo: si faltara la fila, el formulario
    // seguiría avisando de logos demasiado anchos en vez de dejar pasar todo.
    dtf: {
      ancho_rollo_cm: num(dtf.data?.ancho_rollo_cm, 35),
      margen_seguridad_cm: num(dtf.data?.margen_seguridad_cm, 0.5),
    },
    bordado: {
      precio_tarifa_1: num(bordado.data?.precio_tarifa_1),
      precio_tarifa_2: num(bordado.data?.precio_tarifa_2),
      precio_tarifa_3: num(bordado.data?.precio_tarifa_3),
      precio_personalizable_default: num(
        bordado.data?.precio_personalizable_default,
      ),
      unidad_medida:
        (bordado.data?.unidad_medida as UnidadMedidaBordado) ??
        "por_1000_puntadas",
    },
    picajes: (picajes.data ?? [])
      .map((fila) => ({
        codigo: fila.codigo as CodigoPicaje,
        nombre: fila.nombre as string,
        precio_base: num(fila.precio_base),
        editable_en_presupuesto: fila.editable_en_presupuesto === true,
      }))
      .sort(
        (a, b) =>
          ORDEN_PICAJE.indexOf(a.codigo) - ORDEN_PICAJE.indexOf(b.codigo),
      ),
    sublimacion_disponible: num(sublimacion.data?.precio_unitario_base) > 0,
  };
}

// ---------------------------------------------------------------------------
// Reconstrucción de una línea guardada (edición)
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Json {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function leerNumero(fuente: Json, clave: string): number | null {
  const valor = fuente[clave];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function leerTexto(fuente: Json, clave: string): string | null {
  const valor = fuente[clave];
  return typeof valor === "string" ? valor : null;
}

const POSICIONES: Posicion[] = ["pecho", "espalda", "manga", "gorra", "otro"];

function leerPosicion(fuente: Json, clave: string): Posicion {
  const valor = leerTexto(fuente, clave);
  return POSICIONES.includes(valor as Posicion) ? (valor as Posicion) : "pecho";
}

/**
 * Logos tal como los escribió Sonia: el bloque `wizard` que añade el puente al
 * snapshot del motor. Es la fuente preferida porque conserva la posición y las
 * medidas sin rotar.
 */
function leerLogosWizard(wizard: Json): LogoDTFWizard[] {
  const lista = Array.isArray(wizard.logos) ? wizard.logos : [];
  return lista.filter(esObjeto).map((logo) => ({
    posicion: leerPosicion(logo, "posicion"),
    ancho_cm: leerNumero(logo, "ancho_cm") ?? 0,
    alto_cm: leerNumero(logo, "alto_cm") ?? 0,
    rotable: logo.rotable === true,
  }));
}

/**
 * Respaldo para líneas guardadas antes del Prompt 8, que no llevan bloque
 * `wizard`: se reconstruyen desde los inputs del motor.
 */
function leerLogosSnapshot(tecnica: string, inputs: Json): LogoDTFWizard[] {
  if (tecnica === "DTF") {
    return [
      {
        posicion: leerPosicion(inputs, "posicion"),
        ancho_cm: leerNumero(inputs, "ancho_logo_cm") ?? 0,
        alto_cm: leerNumero(inputs, "alto_logo_cm") ?? 0,
        rotable: false,
      },
    ];
  }

  // Composición sin bloque `wizard`: el motor no guarda la posición, así que
  // todos vuelven como "pecho" y Sonia los corrige si hace falta.
  const lista = Array.isArray(inputs.logos) ? inputs.logos : [];
  return lista.filter(esObjeto).map((logo) => ({
    posicion: "pecho" as Posicion,
    ancho_cm: leerNumero(logo, "ancho_cm") ?? 0,
    alto_cm: leerNumero(logo, "alto_cm") ?? 0,
    rotable: logo.rotable === true,
  }));
}

/**
 * Devuelve los datos del wizard equivalentes a una línea ya guardada, para
 * precargar el formulario de edición. Se reconstruye desde el snapshot
 * `detalle_calculo.inputs`, que es la copia fiel de lo que se introdujo.
 *
 * Devuelve `null` si el snapshot no tiene la forma esperada: en ese caso la
 * línea no se puede reeditar y hay que borrarla y rehacerla.
 */
export function reconstruirDatosLinea(linea: {
  cantidad: number;
  prenda_id: string | null;
  color: string | null;
  color_grupo: ColorGrupo | null;
  ancho_logo_cm: number | null;
  alto_logo_cm: number | null;
  detalle_calculo: unknown;
}): DatosLineaWizard | null {
  if (!esObjeto(linea.detalle_calculo)) return null;
  const snapshot = linea.detalle_calculo;
  const inputs = snapshot.inputs;
  if (!esObjeto(inputs)) return null;

  const tecnica = leerTexto(snapshot, "tecnica");
  let detalles: DetallesTecnica;

  switch (tecnica) {
    // Las dos variantes de DTF vuelven al mismo formulario: una lista de
    // logos. Con un elemento el wizard rehará el cálculo simple y con varios
    // el compuesto, igual que la primera vez (Prompt 8).
    case "DTF":
    case "DTF_COMPOSICION": {
      const wizard = esObjeto(snapshot.wizard) ? snapshot.wizard : null;
      const logos = wizard
        ? leerLogosWizard(wizard)
        : leerLogosSnapshot(tecnica, inputs);

      if (!logos.length) return null;

      detalles = {
        tecnica: "DTF",
        logos,
        incluir_vectorizacion:
          wizard?.incluir_vectorizacion === true ||
          inputs.incluir_vectorizacion === true,
      };
      break;
    }

    case "BORDADO":
      detalles = {
        tecnica: "BORDADO",
        posicion: leerPosicion(inputs, "posicion"),
        ancho_logo_cm: linea.ancho_logo_cm,
        alto_logo_cm: linea.alto_logo_cm,
        puntadas: leerNumero(inputs, "puntadas") ?? 0,
        tarifa: (leerTexto(inputs, "tarifa_seleccionada") ??
          "tarifa_1") as TarifaBordado,
        precio_personalizado: leerNumero(inputs, "precio_personalizado"),
        trabajo_nuevo: inputs.trabajo_nuevo === true,
        tipo_picaje: (leerTexto(inputs, "tipo_picaje") ??
          null) as CodigoPicaje | null,
        precio_picaje_personalizado: leerNumero(
          inputs,
          "precio_picaje_personalizado",
        ),
      };
      break;

    case "SERIGRAFIA":
      detalles = {
        tecnica: "SERIGRAFIA",
        ubicacion: leerTexto(inputs, "ubicacion") === "espalda" ? "espalda" : "pecho",
        num_colores: leerNumero(inputs, "num_colores") === 2 ? 2 : 1,
        prenda_oscura: inputs.prenda_oscura === true,
        trabajo_nuevo: inputs.trabajo_nuevo === true,
        incluir_vectorizacion: inputs.incluir_vectorizacion === true,
        incluir_pantone: inputs.incluir_pantone === true,
        cantidad_pantones: leerNumero(inputs, "cantidad_pantones"),
      };
      break;

    case "IMPRESION_DIRECTA":
      detalles = {
        tecnica: "IMPRESION_DIRECTA",
        ubicacion: leerTexto(inputs, "ubicacion") === "espalda" ? "espalda" : "pecho",
        num_colores: leerNumero(inputs, "num_colores") === 2 ? 2 : 1,
        prenda_oscura: inputs.prenda_oscura === true,
        incluir_vectorizacion: inputs.incluir_vectorizacion === true,
      };
      break;

    case "SUBLIMACION":
      detalles = {
        tecnica: "SUBLIMACION",
        posicion: leerPosicion(inputs, "posicion"),
      };
      break;

    default:
      return null;
  }

  return {
    cantidad: linea.cantidad,
    prenda_id: linea.prenda_id,
    color: linea.color,
    color_grupo: linea.color_grupo,
    detalles,
  };
}
