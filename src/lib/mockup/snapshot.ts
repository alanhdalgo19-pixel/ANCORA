// F2.3 — bloque `mockup` del snapshot de una línea (`detalle_calculo.mockup`).
//
// Es un añadido al snapshot del motor, como el bloque `wizard` del Prompt 8:
// no sustituye nada. Guarda lo justo para volver a dibujar el mockup en el PDF
// y para restaurarlo al reeditar la línea, sin recalcular desde el catálogo
// actual (inmutabilidad, CLAUDE.md 7.6): si mañana Espe cambia el tipo de una
// prenda, un presupuesto ya enviado sigue pintando el polo con el que se hizo.
//
// Del logo se copian también nombre y formato, no solo el id: si el logo se
// borra de la biblioteca, el PDF todavía puede rotular la caja con su nombre.
//
// Módulo puro: sin React ni Supabase.

import type { ColorGrupo, Ubicacion } from "@/lib/calculos/types";
import { FORMATOS_PERMITIDOS, type FormatoLogo } from "@/lib/logos/validar";
import type { DetallesTecnica } from "@/types/presupuestos";
import { esTipoPrenda, type TipoPrenda } from "./dimensiones-prendas";

export const VERSION_MOCKUP = "1.0";

export interface LogoMockupSnapshot {
  ubicacion: Ubicacion;
  ancho_cm: number;
  alto_cm: number;
  /**
   * Siempre `false` en F2.3. "Rotable" en DTF significa que el logo puede
   * girarse EN EL ROLLO para gastar menos film; sobre la prenda se estampa en
   * su orientación original (Prompt 8, decisión 3). Se guarda el campo para
   * que F2.4 pueda introducir un giro real sobre la prenda sin migrar datos.
   */
  rotado: boolean;
}

export interface MockupSnapshot {
  version: string;
  logo_id: string | null;
  logo_nombre: string | null;
  logo_formato: FormatoLogo | null;
  tipo_prenda: TipoPrenda;
  color_prenda: ColorGrupo;
  logos: LogoMockupSnapshot[];
}

/** Datos del logo elegido, tal como los conoce el puente. */
export interface LogoElegido {
  id: string;
  nombre: string;
  formato: FormatoLogo;
}

/** `prendas.tipo_mockup` puede ser null (prenda sin clasificar) → "otro". */
export function resolverTipoPrenda(tipoMockup: string | null | undefined): TipoPrenda {
  const normalizado = (tipoMockup ?? "").trim().toLowerCase();
  return esTipoPrenda(normalizado) ? normalizado : "otro";
}

/** Un PDF o un SVG no se pueden incrustar como imagen en @react-pdf/renderer. */
export function formatoRasterizable(formato: FormatoLogo | null): boolean {
  return formato === "png" || formato === "jpg" || formato === "jpeg";
}

function medidaValida(valor: number | null | undefined): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function logoSiMedidas(
  ubicacion: Ubicacion,
  ancho: number | null | undefined,
  alto: number | null | undefined,
): LogoMockupSnapshot[] {
  if (!medidaValida(ancho) || !medidaValida(alto)) return [];
  return [{ ubicacion, ancho_cm: ancho, alto_cm: alto, rotado: false }];
}

/**
 * Logos que se pueden dibujar a partir de los detalles del paso 4. Solo entran
 * los que tienen ancho y alto válidos: en serigrafía, impresión directa y
 * sublimación las medidas son opcionales y, sin ellas, no hay nada que pintar.
 */
export function logosMockupDeDetalles(
  detalles: DetallesTecnica,
): LogoMockupSnapshot[] {
  switch (detalles.tecnica) {
    case "DTF":
      return detalles.logos.flatMap((logo) =>
        logoSiMedidas(logo.posicion, logo.ancho_cm, logo.alto_cm),
      );
    case "BORDADO":
    case "SUBLIMACION":
      return logoSiMedidas(
        detalles.posicion,
        detalles.ancho_logo_cm,
        detalles.alto_logo_cm,
      );
    case "SERIGRAFIA":
    case "IMPRESION_DIRECTA":
      return logoSiMedidas(
        detalles.ubicacion,
        detalles.ancho_logo_cm,
        detalles.alto_logo_cm,
      );
  }
}

/**
 * Bloque `mockup` de una línea, o `null` si no hay nada que guardar (ni logo
 * elegido ni medidas que dibujar).
 */
export function construirMockupSnapshot(entrada: {
  detalles: DetallesTecnica;
  tipo_mockup: string | null | undefined;
  color_grupo: ColorGrupo | null;
  logo: LogoElegido | null;
}): MockupSnapshot | null {
  const logos = logosMockupDeDetalles(entrada.detalles);
  if (!logos.length && !entrada.logo) return null;

  return {
    version: VERSION_MOCKUP,
    logo_id: entrada.logo?.id ?? null,
    logo_nombre: entrada.logo?.nombre ?? null,
    logo_formato: entrada.logo?.formato ?? null,
    tipo_prenda: resolverTipoPrenda(entrada.tipo_mockup),
    // Sin prenda del catálogo (el cliente la aporta) no se sabe el color: se
    // pinta en blanco, que es el fondo más neutro.
    color_prenda: entrada.color_grupo ?? "blanco",
    logos,
  };
}

// ---------------------------------------------------------------------------
// Lectura defensiva: `detalle_calculo` llega como `unknown` (columna jsonb).
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Json {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

const UBICACIONES: Ubicacion[] = ["pecho", "espalda", "manga", "otro"];
const COLORES: ColorGrupo[] = ["blanco", "color", "oscuro"];

function texto(fuente: Json, clave: string): string | null {
  const valor = fuente[clave];
  return typeof valor === "string" ? valor : null;
}

/**
 * Lee el bloque `mockup` de un `detalle_calculo`. Devuelve `null` si la línea
 * no lo tiene (líneas anteriores a F2.3, extras, prendas) o si está dañado.
 */
export function leerMockupSnapshot(detalleCalculo: unknown): MockupSnapshot | null {
  if (!esObjeto(detalleCalculo)) return null;
  const bloque = detalleCalculo.mockup;
  if (!esObjeto(bloque)) return null;

  const logos = (Array.isArray(bloque.logos) ? bloque.logos : [])
    .filter(esObjeto)
    .flatMap((logo) => {
      const ubicacion = texto(logo, "ubicacion") as Ubicacion | null;
      const ancho = logo.ancho_cm;
      const alto = logo.alto_cm;
      if (
        !ubicacion ||
        !UBICACIONES.includes(ubicacion) ||
        typeof ancho !== "number" ||
        typeof alto !== "number" ||
        !medidaValida(ancho) ||
        !medidaValida(alto)
      ) {
        return [];
      }
      return [{ ubicacion, ancho_cm: ancho, alto_cm: alto, rotado: logo.rotado === true }];
    });

  const color = texto(bloque, "color_prenda") as ColorGrupo | null;
  const formato = texto(bloque, "logo_formato") as FormatoLogo | null;

  return {
    version: texto(bloque, "version") ?? VERSION_MOCKUP,
    logo_id: texto(bloque, "logo_id"),
    logo_nombre: texto(bloque, "logo_nombre"),
    logo_formato:
      formato && (FORMATOS_PERMITIDOS as readonly string[]).includes(formato)
        ? formato
        : null,
    tipo_prenda: resolverTipoPrenda(texto(bloque, "tipo_prenda")),
    color_prenda: color && COLORES.includes(color) ? color : "blanco",
    logos,
  };
}
