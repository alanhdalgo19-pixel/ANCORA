// F2.4 — dónde cae cada zona de estampación sobre la FOTO de una prenda.
//
// Coordenadas automáticas por `tipo_mockup` (decisión A.3 del prompt): se
// asume que todas las fotos del mismo tipo encuadran la prenda igual, así que
// basta un rectángulo por tipo y ubicación. Van en PORCENTAJE del ancho y alto
// de la foto (origen arriba a la izquierda) para que valgan con cualquier
// resolución.
//
// Son APROXIMACIONES INICIALES. Cuando lleguen las primeras fotos reales se
// ajustan aquí a ojo; si alguna foto concreta no encaja con las de su tipo,
// el siguiente paso sería guardar coordenadas por foto (pendiente futuro).
//
// Cómo se usan (`calcular-layout.ts`): el área imprimible en cm de
// `DIMENSIONES_PRENDAS` (p. ej. pecho del polo, 28 × 18 cm) se encaja dentro
// de este rectángulo conservando la proporción. De ahí sale la escala px/cm
// con la que se dibuja el logo, así que el tamaño del logo sobre la foto
// depende directamente de estos porcentajes.
//
// Módulo puro: sin React ni Supabase.

import type { TipoPrenda } from "./dimensiones-prendas";

export interface RectanguloPct {
  x_pct: number;
  y_pct: number;
  ancho_pct: number;
  alto_pct: number;
}

export interface AreaImprimibleFoto {
  pecho?: RectanguloPct;
  espalda?: RectanguloPct;
  manga?: RectanguloPct;
}

export const AREAS_IMPRIMIBLES_FOTO: Record<TipoPrenda, AreaImprimibleFoto> = {
  polo: {
    pecho: { x_pct: 60, y_pct: 25, ancho_pct: 18, alto_pct: 15 },
    espalda: { x_pct: 25, y_pct: 20, ancho_pct: 50, alto_pct: 55 },
    manga: { x_pct: 5, y_pct: 20, ancho_pct: 15, alto_pct: 10 },
  },
  camiseta: {
    pecho: { x_pct: 35, y_pct: 20, ancho_pct: 30, alto_pct: 30 },
    espalda: { x_pct: 20, y_pct: 15, ancho_pct: 60, alto_pct: 60 },
    manga: { x_pct: 5, y_pct: 20, ancho_pct: 15, alto_pct: 10 },
  },
  sudadera: {
    pecho: { x_pct: 35, y_pct: 25, ancho_pct: 30, alto_pct: 30 },
    espalda: { x_pct: 20, y_pct: 20, ancho_pct: 60, alto_pct: 60 },
    manga: { x_pct: 5, y_pct: 25, ancho_pct: 18, alto_pct: 12 },
  },
  chaleco: {
    pecho: { x_pct: 60, y_pct: 25, ancho_pct: 18, alto_pct: 15 },
    espalda: { x_pct: 20, y_pct: 20, ancho_pct: 60, alto_pct: 60 },
  },
  delantal: {
    pecho: { x_pct: 30, y_pct: 25, ancho_pct: 40, alto_pct: 25 },
  },
  toalla: {
    pecho: { x_pct: 40, y_pct: 10, ancho_pct: 20, alto_pct: 15 },
  },
  // "otro" admite espalda y manga en el mockup abstracto (F2.2); se les da
  // rectángulo también aquí para que una prenda genérica con foto no pierda
  // ubicaciones que sin foto sí tenía.
  otro: {
    pecho: { x_pct: 35, y_pct: 25, ancho_pct: 30, alto_pct: 30 },
    espalda: { x_pct: 20, y_pct: 20, ancho_pct: 60, alto_pct: 60 },
    manga: { x_pct: 5, y_pct: 20, ancho_pct: 15, alto_pct: 10 },
  },
};
