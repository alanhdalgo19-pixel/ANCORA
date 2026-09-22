// F2.2 — dimensiones canónicas de las prendas para el mockup abstracto.
//
// Medias razonables del sector para una talla M extendida en plano. Solo
// sirven para PINTAR: el presupuesto sigue calculándose con las medidas reales
// del logo (CLAUDE.md sección 7) y no lee nada de este módulo. En F2.4, con las
// fotos reales de cada proveedor, estas cifras se refinarán o sustituirán.
//
// Sistema de coordenadas: origen en la esquina superior izquierda de la prenda,
// `x` hacia la derecha y `y` hacia abajo, todo en centímetros. Es el mismo
// sistema del SVG, así que pasar a píxeles es multiplicar por la escala.
//
// Módulo puro: sin React, sin Supabase. Lo usa `calcular-layout.ts`.

export const TIPOS_PRENDA = [
  "polo",
  "camiseta",
  "sudadera",
  "chaleco",
  "delantal",
  "toalla",
  "otro",
] as const;
export type TipoPrenda = (typeof TIPOS_PRENDA)[number];

/** Rectángulo imprimible dentro de la prenda, en cm. */
export interface AreaImprimibleCm {
  x_cm: number;
  y_cm: number;
  ancho_max_cm: number;
  alto_max_cm: number;
}

export interface DimensionesPrenda {
  tipo: TipoPrenda;
  nombre_visible: string;
  ancho_cm: number;
  alto_cm: number;
  /** null = la prenda no admite estampación en esa ubicación. */
  area_imprimible_pecho: AreaImprimibleCm | null;
  area_imprimible_espalda: AreaImprimibleCm | null;
  area_imprimible_manga: AreaImprimibleCm | null;
}

// La "manga" de un rectángulo no existe: se representa como una zona pequeña
// en la esquina superior izquierda, donde caería la manga derecha al mirar la
// prenda de frente. Lo que importa aquí es su tamaño máximo (~9-10 cm), que es
// lo que limita el logo en la realidad.
export const DIMENSIONES_PRENDAS: Record<TipoPrenda, DimensionesPrenda> = {
  polo: {
    tipo: "polo",
    nombre_visible: "Polo",
    ancho_cm: 50,
    alto_cm: 70,
    area_imprimible_pecho: { x_cm: 11, y_cm: 14, ancho_max_cm: 28, alto_max_cm: 18 },
    area_imprimible_espalda: { x_cm: 9, y_cm: 12, ancho_max_cm: 32, alto_max_cm: 40 },
    area_imprimible_manga: { x_cm: 1, y_cm: 6, ancho_max_cm: 9, alto_max_cm: 9 },
  },
  camiseta: {
    tipo: "camiseta",
    nombre_visible: "Camiseta",
    ancho_cm: 50,
    alto_cm: 72,
    area_imprimible_pecho: { x_cm: 11, y_cm: 13, ancho_max_cm: 28, alto_max_cm: 20 },
    area_imprimible_espalda: { x_cm: 9, y_cm: 10, ancho_max_cm: 32, alto_max_cm: 42 },
    area_imprimible_manga: { x_cm: 1, y_cm: 5, ancho_max_cm: 9, alto_max_cm: 9 },
  },
  sudadera: {
    tipo: "sudadera",
    nombre_visible: "Sudadera",
    ancho_cm: 56,
    alto_cm: 68,
    area_imprimible_pecho: { x_cm: 13, y_cm: 16, ancho_max_cm: 30, alto_max_cm: 20 },
    area_imprimible_espalda: { x_cm: 10, y_cm: 12, ancho_max_cm: 36, alto_max_cm: 40 },
    area_imprimible_manga: { x_cm: 1, y_cm: 8, ancho_max_cm: 10, alto_max_cm: 10 },
  },
  chaleco: {
    tipo: "chaleco",
    nombre_visible: "Chaleco",
    ancho_cm: 52,
    alto_cm: 66,
    area_imprimible_pecho: { x_cm: 12, y_cm: 15, ancho_max_cm: 28, alto_max_cm: 18 },
    area_imprimible_espalda: { x_cm: 10, y_cm: 10, ancho_max_cm: 32, alto_max_cm: 38 },
    area_imprimible_manga: null,
  },
  delantal: {
    tipo: "delantal",
    nombre_visible: "Delantal",
    ancho_cm: 60,
    alto_cm: 85,
    area_imprimible_pecho: { x_cm: 15, y_cm: 15, ancho_max_cm: 30, alto_max_cm: 25 },
    area_imprimible_espalda: null,
    area_imprimible_manga: null,
  },
  toalla: {
    tipo: "toalla",
    nombre_visible: "Toalla",
    ancho_cm: 50,
    alto_cm: 100,
    // En una toalla la "zona frontal" es la franja inferior, donde se borda.
    area_imprimible_pecho: { x_cm: 5, y_cm: 70, ancho_max_cm: 40, alto_max_cm: 25 },
    area_imprimible_espalda: null,
    area_imprimible_manga: null,
  },
  otro: {
    tipo: "otro",
    nombre_visible: "Otra prenda",
    ancho_cm: 50,
    alto_cm: 70,
    area_imprimible_pecho: { x_cm: 10, y_cm: 12, ancho_max_cm: 30, alto_max_cm: 25 },
    area_imprimible_espalda: { x_cm: 8, y_cm: 10, ancho_max_cm: 34, alto_max_cm: 45 },
    area_imprimible_manga: { x_cm: 1, y_cm: 6, ancho_max_cm: 9, alto_max_cm: 9 },
  },
};

export function esTipoPrenda(valor: string): valor is TipoPrenda {
  return (TIPOS_PRENDA as readonly string[]).includes(valor);
}

/**
 * Dimensiones de un tipo de prenda. Un tipo desconocido cae en "otro": el
 * mockup es orientativo y es preferible pintar algo genérico a romper la
 * pantalla. `calcularLayoutMockup` avisa en ese caso.
 */
export function obtenerDimensionesPrenda(tipo: string): DimensionesPrenda {
  const normalizado = tipo.trim().toLowerCase();
  return esTipoPrenda(normalizado)
    ? DIMENSIONES_PRENDAS[normalizado]
    : DIMENSIONES_PRENDAS.otro;
}
