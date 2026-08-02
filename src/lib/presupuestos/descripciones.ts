// Textos de las líneas de presupuesto: el título que se guarda en
// `lineas_presupuesto.descripcion` y la sub-línea técnica en gris que el PDF
// muestra debajo (CLAUDE.md 7.9, "descripción enriquecida").
//
// Módulo puro: no toca Supabase. La sub-línea se DERIVA del snapshot
// `detalle_calculo`, no se guarda duplicada, para que siempre refleje cómo se
// calculó realmente la línea aunque cambien las tarifas después.

import type { CodigoTecnica, Posicion } from "@/types/database";
import type { DetallesTecnica } from "@/types/presupuestos";
import { formatMedida } from "@/lib/format";

export const NOMBRE_TECNICA: Record<CodigoTecnica, string> = {
  DTF: "Impresión DTF",
  BORDADO: "Bordado",
  SERIGRAFIA: "Serigrafía",
  IMPRESION_DIRECTA: "Impresión directa",
  SUBLIMACION: "Sublimación",
};

export const DESCRIPCION_TECNICA: Record<CodigoTecnica, string> = {
  DTF: "Transfer digital. Cualquier color y prenda.",
  BORDADO: "Acabado premium y duradero. Se cobra por puntadas.",
  SERIGRAFIA: "Rentable en tiradas grandes. Máximo 2 colores.",
  IMPRESION_DIRECTA: "Directo sobre algodón, sin fotolitos.",
  SUBLIMACION: "Solo poliéster blanco.",
};

export const NOMBRE_POSICION: Record<Posicion, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  manga: "Manga",
  gorra: "Gorra",
  otro: "Otra posición",
};

/** Título de la línea de técnica tal como se guarda y se imprime. */
export function tituloLineaTecnica(
  detalles: DetallesTecnica,
  nombrePrenda: string | null,
): string {
  const tecnica = NOMBRE_TECNICA[detalles.tecnica];

  // DTF con varios logos: no hay una única posición que nombrar, así que el
  // título anuncia la composición y las posiciones bajan a las sub-líneas.
  const base =
    detalles.tecnica === "DTF" && detalles.logos.length > 1
      ? `${tecnica} compuesta (${detalles.logos.length} logos)`
      : `${tecnica} en ${posicionDeDetalles(detalles).toLowerCase()}`;

  return nombrePrenda ? `${base} sobre ${nombrePrenda}` : base;
}

/** Posición representativa de la línea (la del primer logo en composición). */
export function posicionDeDetalles(detalles: DetallesTecnica): string {
  if (detalles.tecnica === "DTF") {
    return NOMBRE_POSICION[detalles.logos[0]?.posicion ?? "pecho"];
  }
  return "posicion" in detalles
    ? NOMBRE_POSICION[detalles.posicion]
    : NOMBRE_POSICION[detalles.ubicacion];
}

/** Título de la línea de venta de prenda. */
export function tituloLineaPrenda(
  nombrePrenda: string,
  color: string | null,
): string {
  return color ? `${nombrePrenda} — ${color}` : nombrePrenda;
}

// ---------------------------------------------------------------------------
// Lectura defensiva del snapshot: `detalle_calculo` llega tipado como
// `unknown` desde la base de datos (columna jsonb).
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Json {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function leerObjeto(fuente: unknown, clave: string): Json | null {
  if (!esObjeto(fuente)) return null;
  const valor = fuente[clave];
  return esObjeto(valor) ? valor : null;
}

function leerNumero(fuente: Json | null, clave: string): number | null {
  if (!fuente) return null;
  const valor = fuente[clave];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function leerTexto(fuente: Json | null, clave: string): string | null {
  if (!fuente) return null;
  const valor = fuente[clave];
  return typeof valor === "string" ? valor : null;
}

function leerBooleano(fuente: Json | null, clave: string): boolean {
  return fuente?.[clave] === true;
}

function leerLista(fuente: Json | null, clave: string): Json[] {
  const valor = fuente?.[clave];
  return Array.isArray(valor) ? valor.filter(esObjeto) : [];
}

/**
 * Sub-líneas de una línea DTF compuesta: una por logo, con su posición y sus
 * medidas. El PDF y el preview las pintan indentadas y en gris, igual que los
 * extras (Prompt 8, parte D).
 *
 * Devuelve `[]` para cualquier otro tipo de línea, de modo que el llamante
 * puede invocarla sin comprobar antes la técnica.
 */
export function sublineasLogosComposicion(detalleCalculo: unknown): string[] {
  if (!esObjeto(detalleCalculo)) return [];
  if (leerTexto(detalleCalculo, "tecnica") !== "DTF_COMPOSICION") return [];

  // Fuente preferida: el bloque `wizard`, que conserva la posición elegida en
  // pantalla. El motor no la guarda porque para el bin packing es irrelevante.
  const wizard = leerObjeto(detalleCalculo, "wizard");
  const logosWizard = leerLista(wizard, "logos");
  if (logosWizard.length) {
    return logosWizard.map((logo) => {
      const posicion = leerTexto(logo, "posicion");
      const nombre =
        posicion && posicion in NOMBRE_POSICION
          ? NOMBRE_POSICION[posicion as Posicion].toLowerCase()
          : "logo";
      return `Logo ${nombre} ${medidas(logo, "ancho_cm", "alto_cm")}`;
    });
  }

  // Respaldo: los inputs del motor, que sí llevan un nombre legible.
  const inputs = leerObjeto(detalleCalculo, "inputs");
  return leerLista(inputs, "logos").map((logo) => {
    const nombre = leerTexto(logo, "nombre") ?? leerTexto(logo, "id") ?? "Logo";
    return `${nombre} ${medidas(logo, "ancho_cm", "alto_cm")}`;
  });
}

function medidas(fuente: Json, claveAncho: string, claveAlto: string): string {
  const ancho = leerNumero(fuente, claveAncho);
  const alto = leerNumero(fuente, claveAlto);
  if (ancho === null || alto === null) return "";
  return `${formatMedida(ancho)} × ${formatMedida(alto)} cm`;
}

/**
 * Sub-línea técnica en gris pequeño debajo de la descripción principal.
 * Devuelve `null` si el snapshot no tiene la forma esperada (líneas antiguas o
 * importadas), en cuyo caso el PDF muestra solo la descripción.
 */
export function subdescripcionLinea(detalleCalculo: unknown): string | null {
  if (!esObjeto(detalleCalculo)) return null;

  const inputs = leerObjeto(detalleCalculo, "inputs");
  const calculo = leerObjeto(detalleCalculo, "calculo");
  const tecnica = leerTexto(detalleCalculo, "tecnica");
  const partes: string[] = [];

  switch (tecnica) {
    case "DTF": {
      // Se prefieren las medidas del bloque `wizard`: son las que se estampan
      // sobre la prenda. Las de `inputs` pueden venir rotadas si el logo era
      // rotable, y esa rotación es un detalle de cómo se corta el rollo.
      const logoWizard = leerLista(leerObjeto(detalleCalculo, "wizard"), "logos")[0];
      const ancho = logoWizard
        ? leerNumero(logoWizard, "ancho_cm")
        : leerNumero(inputs, "ancho_logo_cm");
      const alto = logoWizard
        ? leerNumero(logoWizard, "alto_cm")
        : leerNumero(inputs, "alto_logo_cm");
      if (ancho !== null && alto !== null) {
        partes.push(`Logo ${formatMedida(ancho)} × ${formatMedida(alto)} cm`);
      }
      const metros = leerNumero(calculo, "metros_necesarios");
      if (metros !== null) partes.push(`${formatMedida(metros)} m de rollo`);
      break;
    }
    case "DTF_COMPOSICION": {
      // Los metros y la eficiencia salen del bloque `composicion`, no de
      // `calculo`: es el bin packing quien los determina.
      const composicion = leerObjeto(detalleCalculo, "composicion");
      const total = leerNumero(inputs, "cantidad_total");
      if (total !== null) partes.push(`${total} logos en total`);
      const metros = leerNumero(composicion, "metros_necesarios");
      if (metros !== null) partes.push(`${formatMedida(metros)} m de rollo`);
      const eficiencia = leerNumero(composicion, "eficiencia_pct");
      if (eficiencia !== null) {
        partes.push(`${formatMedida(eficiencia)} % de aprovechamiento`);
      }
      break;
    }
    case "BORDADO": {
      const puntadas = leerNumero(inputs, "puntadas");
      if (puntadas !== null) {
        partes.push(`${puntadas.toLocaleString("es-ES")} puntadas`);
      }
      const descuento = leerNumero(calculo, "descuento_habitual_pct");
      if (descuento) partes.push(`Descuento cliente habitual ${descuento}%`);
      break;
    }
    case "SERIGRAFIA":
    case "IMPRESION_DIRECTA": {
      const colores = leerNumero(inputs, "num_colores");
      if (colores !== null) {
        partes.push(`${colores} ${colores === 1 ? "color" : "colores"}`);
      }
      if (leerBooleano(inputs, "prenda_oscura")) partes.push("Prenda oscura");
      break;
    }
    case "SUBLIMACION": {
      const merma = leerNumero(calculo, "merma");
      if (merma) partes.push("Incluye merma de proceso");
      break;
    }
    case "PRENDA":
      return null;
    default:
      return null;
  }

  if (leerBooleano(calculo, "aplicado_minimo")) {
    partes.push("mínimo de trabajo aplicado");
  }

  return partes.length ? partes.join(" · ") : null;
}

/** Sub-línea de una línea de tipo 'prenda' (color y tramo de precio). */
export function subdescripcionPrenda(detalleCalculo: unknown): string | null {
  if (!esObjeto(detalleCalculo)) return null;
  if (leerTexto(detalleCalculo, "tipo") !== "PRENDA") return null;

  const calculo = leerObjeto(detalleCalculo, "calculo");
  const inputs = leerObjeto(detalleCalculo, "inputs");
  const partes: string[] = [];

  const colorGrupo = leerTexto(inputs, "color_grupo");
  if (colorGrupo) partes.push(`Grupo de color: ${colorGrupo}`);

  const tramo = leerTexto(calculo, "tramo_cantidad");
  if (tramo) partes.push(`Tramo ${tramo} uds`);

  return partes.length ? partes.join(" · ") : null;
}
