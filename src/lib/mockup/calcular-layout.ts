// F2.2 — cálculo puro del layout del mockup.
//
// Toda la matemática del mockup vive aquí: escala, posiciones, casos límite y
// avisos. `<Mockup>` solo llama a esta función y pinta lo que devuelve. Así la
// lógica se testea sin renderizar y F2.3 podrá reutilizar exactamente las
// mismas coordenadas al rasterizar el mockup para el PDF.
//
// Todas las coordenadas que devuelve están en la unidad de dibujo pedida, con
// origen en la esquina superior izquierda de la prenda. Las medidas en cm se
// conservan al lado para las etiquetas y para auditar.
//
// F2.3 — unidad de dibujo parametrizada:
//   · "px" (por defecto): píxeles del SVG del navegador. La prenda ocupa
//     `alto_pixels` de ALTO (400 por defecto), como en F2.2.
//   · "pt": puntos tipográficos del PDF (@react-pdf/renderer). La prenda ocupa
//     `ancho_pt` de ANCHO (180 por defecto): en el PDF el mockup va en una
//     columna de ancho fijo y lo que varía entre prendas es el alto.
// La matemática es idéntica; solo cambia la escala base. Los campos siguen
// llamándose `*_px` por compatibilidad con F2.2: en modo "pt" contienen puntos.
//
// F2.4 — dos modos de dibujo:
//   · "rectangulo_abstracto": el de F2.2, intacto. Es el fallback cuando la
//     prenda no tiene foto para ese color.
//   · "foto_real": el lienzo toma la proporción de la foto y el área
//     imprimible sale de `AREAS_IMPRIMIBLES_FOTO` (porcentajes por tipo). El
//     área en cm de `DIMENSIONES_PRENDAS` se encaja dentro de ese rectángulo
//     conservando la proporción: de ahí sale la escala del LOGO
//     (`escala_logo_px_por_cm`), distinta de la de los textos
//     (`escala_px_por_cm`, que sigue ligada al tamaño total de la prenda para
//     que las etiquetas se lean igual con foto que sin ella).
// Las reglas de negocio del logo (centrado, margen de 2 cm, "excede") se
// calculan en cm y no cambian entre modos.

import type { ColorGrupo, Ubicacion } from "@/lib/calculos/types";
import { AREAS_IMPRIMIBLES_FOTO, type RectanguloPct } from "./areas-imprimibles-foto";
import {
  esTipoPrenda,
  obtenerDimensionesPrenda,
  type AreaImprimibleCm,
  type DimensionesPrenda,
  type TipoPrenda,
} from "./dimensiones-prendas";

export const ALTO_PIXELS_POR_DEFECTO = 400;

/** Ancho del bloque de mockup en el PDF: ~6,35 cm sobre el A4. */
export const ANCHO_PT_POR_DEFECTO = 180;

export type UnidadMockup = "px" | "pt";

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
  /** Unidad de dibujo. Por defecto "px" (navegador). */
  unidad?: UnidadMockup;
  /** Solo en "px": alto de la prenda en píxeles. */
  alto_pixels?: number;
  /** Solo en "pt": ancho de la prenda en puntos del PDF. */
  ancho_pt?: number;
  /** F2.4 — foto real de la prenda; null/ausente → rectángulo abstracto. */
  foto?: FotoPrendaMockup | null;
}

/** Foto real ya resuelta (URL servible + dimensiones leídas al subirla). */
export interface FotoPrendaMockup {
  url: string;
  /** null si no se pudieron leer: se usa la proporción de la prenda abstracta. */
  ancho_px: number | null;
  alto_px: number | null;
}

export type ModoMockup = "foto_real" | "rectangulo_abstracto";

/**
 * Cómo se funde el logo con la foto. `multiply` respeta sombras y arrugas
 * (parece estampado), pero sobre una prenda oscura oscurece el logo hasta
 * hacerlo desaparecer: ahí se superpone plano.
 */
export type MezclaLogo = "multiply" | "normal";

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
  /** F2.4 — siempre "normal" en el rectángulo abstracto. */
  mezcla: MezclaLogo;
  /** Línea base de la etiqueta "9 × 4 cm", centrada bajo el logo. */
  etiqueta_x_px: number;
  etiqueta_y_px: number;
}

export interface LayoutMockup {
  /** Unidad en la que están expresados todos los campos `*_px`. */
  unidad: UnidadMockup;
  /** F2.4 — con foto real o con el rectángulo de F2.2. */
  modo: ModoMockup;
  /** Foto que ocupa todo el lienzo (0,0 → svg_ancho × svg_alto); null en abstracto. */
  foto: { url: string; ancho_px: number; alto_px: number } | null;
  svg_ancho_px: number;
  svg_alto_px: number;
  /** Escala de la PRENDA: textos, bandas y esquinas. */
  escala_px_por_cm: number;
  /** Escala del LOGO y del área. Igual a la anterior en el modo abstracto. */
  escala_logo_px_por_cm: number;
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


/** Rectángulo de la foto (en %) que corresponde a cada ubicación. */
function areaFotoDeUbicacion(
  tipo: TipoPrenda,
  ubicacion: Ubicacion,
): RectanguloPct | null {
  const areas = AREAS_IMPRIMIBLES_FOTO[tipo];
  switch (ubicacion) {
    case "espalda":
      return areas.espalda ?? null;
    case "manga":
      return areas.manga ?? null;
    case "pecho":
    case "otro":
      return areas.pecho ?? null;
  }
}

/** Área ya colocada en unidades de dibujo + la escala con la que se mide. */
interface AreaColocada {
  x: number;
  y: number;
  escala: number;
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

  const unidad: UnidadMockup = entrada.unidad ?? "px";
  const modo: ModoMockup = entrada.foto?.url ? "foto_real" : "rectangulo_abstracto";

  // 1. Tamaño del lienzo. En pantalla manda el alto (`alto_pixels`); en el
  //    PDF, el ancho (`ancho_pt`). La proporción es la de la prenda abstracta
  //    o, con foto, la de la propia foto.
  const proporcionFoto =
    entrada.foto &&
    esMedidaValida(entrada.foto.ancho_px ?? NaN) &&
    esMedidaValida(entrada.foto.alto_px ?? NaN)
      ? (entrada.foto.ancho_px as number) / (entrada.foto.alto_px as number)
      : null;
  const proporcion =
    modo === "foto_real" && proporcionFoto !== null
      ? proporcionFoto
      : prenda.ancho_cm / prenda.alto_cm;

  let lienzoAncho: number;
  let lienzoAlto: number;
  if (unidad === "pt") {
    lienzoAncho = esMedidaValida(entrada.ancho_pt ?? NaN)
      ? (entrada.ancho_pt as number)
      : ANCHO_PT_POR_DEFECTO;
    lienzoAlto = lienzoAncho / proporcion;
  } else {
    lienzoAlto = esMedidaValida(entrada.alto_pixels ?? NaN)
      ? (entrada.alto_pixels as number)
      : ALTO_PIXELS_POR_DEFECTO;
    lienzoAncho = lienzoAlto * proporcion;
  }

  // Escala de la prenda (textos, banda, esquinas): la misma que en F2.2.
  const escala =
    unidad === "pt" ? lienzoAncho / prenda.ancho_cm : lienzoAlto / prenda.alto_cm;
  const px = (cm: number) => cm * escala;

  const color = entrada.color_prenda ?? "blanco";
  const colores = COLORES_PRENDA[color];
  const vista = entrada.ubicacion === "espalda" ? "trasera" : "delantera";

  const etiquetaUbicacion = entrada.ubicacion.toUpperCase();
  const areaCm = areaDeUbicacion(prenda, entrada.ubicacion);
  const areaPct =
    modo === "foto_real" ? areaFotoDeUbicacion(prenda.tipo, entrada.ubicacion) : null;

  // 2. Dónde cae el área imprimible y a qué escala se mide el logo.
  let colocada: AreaColocada | null = null;
  if (areaCm && modo === "rectangulo_abstracto") {
    colocada = { x: px(areaCm.x_cm), y: px(areaCm.y_cm), escala };
  } else if (areaCm && areaPct) {
    const cajaX = (areaPct.x_pct / 100) * lienzoAncho;
    const cajaY = (areaPct.y_pct / 100) * lienzoAlto;
    const cajaAncho = (areaPct.ancho_pct / 100) * lienzoAncho;
    const cajaAlto = (areaPct.alto_pct / 100) * lienzoAlto;
    const escalaLogo = Math.min(
      cajaAncho / areaCm.ancho_max_cm,
      cajaAlto / areaCm.alto_max_cm,
    );
    colocada = {
      // Centrada en horizontal dentro de la caja de la foto y pegada arriba,
      // igual que el logo dentro de su área.
      x: cajaX + (cajaAncho - areaCm.ancho_max_cm * escalaLogo) / 2,
      y: cajaY,
      escala: escalaLogo,
    };
  }

  const logoValido =
    esMedidaValida(entrada.logo_ancho_cm) &&
    esMedidaValida(entrada.logo_alto_cm);

  let area: LayoutMockup["area"];
  let logo: LogoLayout | null = null;

  if (!areaCm || !colocada) {
    area = { disponible: false, etiqueta: etiquetaUbicacion };
    warnings.push(AVISO_UBICACION_NO_DISPONIBLE);
  } else {
    const s = colocada.escala;
    area = {
      disponible: true,
      etiqueta: etiquetaUbicacion,
      x_px: colocada.x,
      y_px: colocada.y,
      ancho_px: areaCm.ancho_max_cm * s,
      alto_px: areaCm.alto_max_cm * s,
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

      // 3. Centrado horizontal dentro del área (si excede, desborda por igual
      //    a ambos lados). 4. Arriba con 2 cm de margen; si el logo cabe pero
      //    no con el margen entero, el margen se recorta para no sacarlo del
      //    área por abajo — un logo que cabe no debe pintarse como si no.
      //    Desplazamientos en cm relativos al área, luego a su escala.
      const dxCm = (areaCm.ancho_max_cm - anchoCm) / 2;
      const dyCm = Math.max(
        0,
        Math.min(MARGEN_SUPERIOR_LOGO_CM, areaCm.alto_max_cm - altoCm),
      );
      const x = colocada.x + dxCm * s;
      const y = colocada.y + dyCm * s;

      logo = {
        x_px: x,
        y_px: y,
        ancho_px: anchoCm * s,
        alto_px: altoCm * s,
        ancho_cm: anchoCm,
        alto_cm: altoCm,
        excede_area: excede,
        tiene_url: entrada.logo_url !== null && entrada.logo_url !== "",
        url: entrada.logo_url || null,
        mezcla: modo === "foto_real" && color !== "oscuro" ? "multiply" : "normal",
        etiqueta_x_px: x + (anchoCm * s) / 2,
        // La separación de la etiqueta va a escala de texto: con foto, el
        // logo puede ser pequeño y la etiqueta quedaría pegada.
        etiqueta_y_px: y + altoCm * s + px(SEPARACION_ETIQUETA_CM),
      };
    }
  }

  return {
    unidad,
    modo,
    foto:
      modo === "foto_real" && entrada.foto
        ? { url: entrada.foto.url, ancho_px: lienzoAncho, alto_px: lienzoAlto }
        : null,
    svg_ancho_px: lienzoAncho,
    svg_alto_px: lienzoAlto,
    escala_px_por_cm: escala,
    escala_logo_px_por_cm: colocada?.escala ?? escala,
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
