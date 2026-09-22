// F2.2 — cálculo puro del layout del mockup.
//
// Toda la matemática del mockup vive aquí: escala, posiciones, casos límite y
// avisos. `<Mockup>` solo llama a esta función y pinta lo que devuelve. Así la
// lógica se testea sin renderizar y F2.3 podrá reutilizar exactamente las
// mismas coordenadas al rasterizar el mockup para el PDF.
//
// Todas las coordenadas que devuelve están en píxeles del SVG, con origen en la
// esquina superior izquierda de la prenda. Las medidas en cm se conservan al
// lado para las etiquetas y para auditar.

import type { ColorGrupo, Ubicacion } from "@/lib/calculos/types";
import {
  esTipoPrenda,
  obtenerDimensionesPrenda,
  type AreaImprimibleCm,
  type DimensionesPrenda,
  type TipoPrenda,
} from "./dimensiones-prendas";

export const ALTO_PIXELS_POR_DEFECTO = 400;

/** Margen entre el borde superior del área imprimible y el logo. */
export const MARGEN_SUPERIOR_LOGO_CM = 2;

// Tamaños de texto en cm "de prenda": al escalar con la prenda, las etiquetas
// mantienen la proporción cuando el mockup se pinta más grande o más pequeño.
const FUENTE_TITULO_CM = 2.2;
const FUENTE_ETIQUETA_CM = 1.6;
/** Alto de la banda "VISTA TRASERA" que distingue la espalda. */
const BANDA_TRASERA_CM = 5;
/** Separación entre el borde inferior del logo y su etiqueta de medidas. */
const SEPARACION_ETIQUETA_CM = 1.8;

export const AVISO_UBICACION_NO_DISPONIBLE =
  "Ubicación no disponible para este tipo de prenda";
export const AVISO_EXCEDE_AREA = "El logo excede el área imprimible";

const COLORES_PRENDA: Record<
  ColorGrupo,
  { fondo: string; borde: string; texto: string; texto_suave: string }
> = {
  blanco: { fondo: "#ffffff", borde: "#d4d4d4", texto: "#1a1a1a", texto_suave: "#8a8a8a" },
  color: { fondo: "#e0e0e0", borde: "#bdbdbd", texto: "#1a1a1a", texto_suave: "#5a5a5a" },
  oscuro: { fondo: "#333333", borde: "#1a1a1a", texto: "#fafafa", texto_suave: "#c4c4c4" },
};

export interface EntradaLayoutMockup {
  tipo_prenda: string;
  color_prenda?: ColorGrupo;
  logo_url: string | null;
  logo_ancho_cm: number;
  logo_alto_cm: number;
  ubicacion: Ubicacion;
  alto_pixels?: number;
}

export interface AreaLayout {
  disponible: true;
  etiqueta: string;
  x_px: number;
  y_px: number;
  ancho_px: number;
  alto_px: number;
  ancho_cm: number;
  alto_cm: number;
}

export interface LogoLayout {
  x_px: number;
  y_px: number;
  ancho_px: number;
  alto_px: number;
  ancho_cm: number;
  alto_cm: number;
  excede_area: boolean;
  tiene_url: boolean;
  url: string | null;
  /** Línea base de la etiqueta "9 × 4 cm", centrada bajo el logo. */
  etiqueta_x_px: number;
  etiqueta_y_px: number;
}

export interface LayoutMockup {
  svg_ancho_px: number;
  svg_alto_px: number;
  escala_px_por_cm: number;
  prenda: {
    tipo: TipoPrenda;
    nombre_visible: string;
    ancho_cm: number;
    alto_cm: number;
    color: ColorGrupo;
    color_fondo: string;
    color_borde: string;
    color_texto: string;
    color_texto_suave: string;
  };
  vista: "delantera" | "trasera";
  /** Alto en px de la banda "VISTA TRASERA" (0 en vista delantera). */
  banda_trasera_alto_px: number;
  area: AreaLayout | { disponible: false; etiqueta: string };
  /** null cuando no hay dónde colocarlo (ubicación no disponible o medidas inválidas). */
  logo: LogoLayout | null;
  etiqueta_dimensiones: string;
  tamano_fuente_titulo_px: number;
  tamano_fuente_etiqueta_px: number;
  warnings: string[];
}

const FORMATO_CM = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});

/** "9 × 4 cm", "9,5 × 4 cm". */
export function formatearDimensiones(anchoCm: number, altoCm: number): string {
  return `${FORMATO_CM.format(anchoCm)} × ${FORMATO_CM.format(altoCm)} cm`;
}

/** Qué área de la prenda corresponde a cada ubicación. 'otro' cae en pecho. */
function areaDeUbicacion(
  prenda: DimensionesPrenda,
  ubicacion: Ubicacion,
): AreaImprimibleCm | null {
  switch (ubicacion) {
    case "espalda":
      return prenda.area_imprimible_espalda;
    case "manga":
      return prenda.area_imprimible_manga;
    case "pecho":
    case "otro":
      return prenda.area_imprimible_pecho;
  }
}

function esMedidaValida(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0;
}

export function calcularLayoutMockup(
  entrada: EntradaLayoutMockup,
): LayoutMockup {
  const warnings: string[] = [];

  const tipoNormalizado = entrada.tipo_prenda.trim().toLowerCase();
  if (!esTipoPrenda(tipoNormalizado)) {
    warnings.push(
      `Tipo de prenda "${entrada.tipo_prenda}" desconocido: se muestra una prenda genérica.`,
    );
  }
  const prenda = obtenerDimensionesPrenda(entrada.tipo_prenda);

  const altoPixels = esMedidaValida(entrada.alto_pixels ?? NaN)
    ? (entrada.alto_pixels as number)
    : ALTO_PIXELS_POR_DEFECTO;

  // 1. Escala: la prenda ocupa siempre `alto_pixels` de alto.
  const escala = altoPixels / prenda.alto_cm;
  const px = (cm: number) => cm * escala;

  const color = entrada.color_prenda ?? "blanco";
  const colores = COLORES_PRENDA[color];
  const vista = entrada.ubicacion === "espalda" ? "trasera" : "delantera";

  const etiquetaUbicacion = entrada.ubicacion.toUpperCase();
  const areaCm = areaDeUbicacion(prenda, entrada.ubicacion);

  const logoValido =
    esMedidaValida(entrada.logo_ancho_cm) &&
    esMedidaValida(entrada.logo_alto_cm);

  let area: LayoutMockup["area"];
  let logo: LogoLayout | null = null;

  if (!areaCm) {
    area = { disponible: false, etiqueta: etiquetaUbicacion };
    warnings.push(AVISO_UBICACION_NO_DISPONIBLE);
  } else {
    area = {
      disponible: true,
      etiqueta: etiquetaUbicacion,
      x_px: px(areaCm.x_cm),
      y_px: px(areaCm.y_cm),
      ancho_px: px(areaCm.ancho_max_cm),
      alto_px: px(areaCm.alto_max_cm),
      ancho_cm: areaCm.ancho_max_cm,
      alto_cm: areaCm.alto_max_cm,
    };

    if (!logoValido) {
      warnings.push("Las medidas del logo deben ser mayores que 0.");
    } else {
      const { logo_ancho_cm: anchoCm, logo_alto_cm: altoCm } = entrada;

      const excede =
        anchoCm > areaCm.ancho_max_cm || altoCm > areaCm.alto_max_cm;
      if (excede) {
        warnings.push(
          `${AVISO_EXCEDE_AREA} (máx. ${formatearDimensiones(areaCm.ancho_max_cm, areaCm.alto_max_cm)}).`,
        );
      }

      // 2. Centrado horizontal dentro del área (si excede, desborda por igual
      //    a ambos lados). 3. Arriba con 2 cm de margen; si el logo cabe pero
      //    no con el margen entero, el margen se recorta para no sacarlo del
      //    área por abajo — un logo que cabe no debe pintarse como si no.
      const xCm = areaCm.x_cm + (areaCm.ancho_max_cm - anchoCm) / 2;
      const margenCm = Math.max(
        0,
        Math.min(MARGEN_SUPERIOR_LOGO_CM, areaCm.alto_max_cm - altoCm),
      );
      const yCm = areaCm.y_cm + margenCm;

      logo = {
        x_px: px(xCm),
        y_px: px(yCm),
        ancho_px: px(anchoCm),
        alto_px: px(altoCm),
        ancho_cm: anchoCm,
        alto_cm: altoCm,
        excede_area: excede,
        tiene_url: entrada.logo_url !== null && entrada.logo_url !== "",
        url: entrada.logo_url || null,
        etiqueta_x_px: px(xCm + anchoCm / 2),
        etiqueta_y_px: px(yCm + altoCm + SEPARACION_ETIQUETA_CM),
      };
    }
  }

  return {
    svg_ancho_px: px(prenda.ancho_cm),
    svg_alto_px: px(prenda.alto_cm),
    escala_px_por_cm: escala,
    prenda: {
      tipo: prenda.tipo,
      nombre_visible: prenda.nombre_visible,
      ancho_cm: prenda.ancho_cm,
      alto_cm: prenda.alto_cm,
      color,
      color_fondo: colores.fondo,
      color_borde: colores.borde,
      color_texto: colores.texto,
      color_texto_suave: colores.texto_suave,
    },
    vista,
    banda_trasera_alto_px: vista === "trasera" ? px(BANDA_TRASERA_CM) : 0,
    area,
    logo,
    etiqueta_dimensiones: logoValido
      ? formatearDimensiones(entrada.logo_ancho_cm, entrada.logo_alto_cm)
      : "",
    tamano_fuente_titulo_px: px(FUENTE_TITULO_CM),
    tamano_fuente_etiqueta_px: px(FUENTE_ETIQUETA_CM),
    warnings,
  };
}
