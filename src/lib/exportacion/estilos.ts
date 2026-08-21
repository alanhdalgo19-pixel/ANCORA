// Estilo compartido de las tres pestañas del Excel de exportación (Prompt 9).
//
// Vive en su propio módulo, y no dentro de `generarExcel.ts`, porque los tres
// formateadores lo necesitan y `generarExcel.ts` los importa a ellos: tenerlo
// en el ensamblador crearía un ciclo de imports.

import type ExcelJS from "exceljs";

/** Valor admitido en una celda. `null` deja la celda vacía. */
export type ValorCelda = string | number | Date | null;

export type TipoColumna = "texto" | "numero" | "fecha" | "entero";

export interface ColumnaExcel<T> {
  cabecera: string;
  valor: (fila: T) => ValorCelda;
  tipo?: TipoColumna;
  /** Ancho fijo en caracteres; si se omite se calcula por contenido. */
  ancho?: number;
}

/** Importes y porcentajes: número con 2 decimales, sin símbolo de moneda. */
const FORMATO_NUMERO = "0.00";
/** Cantidades de prendas: siempre unidades enteras. */
const FORMATO_ENTERO = "0";
const FORMATO_FECHA = "dd/mm/yyyy";

const GRIS_CABECERA = "FFEFEFEF";
const GRIS_BORDE = "FFD4D4D4";

const ANCHO_MINIMO = 10;
const ANCHO_MAXIMO = 50;

const BORDE_FINO: ExcelJS.Borders = {
  top: { style: "thin", color: { argb: GRIS_BORDE } },
  left: { style: "thin", color: { argb: GRIS_BORDE } },
  bottom: { style: "thin", color: { argb: GRIS_BORDE } },
  right: { style: "thin", color: { argb: GRIS_BORDE } },
} as ExcelJS.Borders;

/**
 * Fecha `YYYY-MM-DD` → `Date` a medianoche UTC.
 *
 * Excel guarda las fechas como número de serie y ExcelJS lo calcula sobre el
 * tiempo UTC del `Date`: usar medianoche UTC garantiza un serial entero, es
 * decir, el mismo día que se ve en la aplicación sin desplazamientos por huso
 * horario. El día natural ya se resolvió en `consultas.ts` (hora de Madrid).
 */
export function fechaExcel(fecha: string | null | undefined): Date | null {
  if (!fecha) return null;
  const instante = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(instante.getTime()) ? null : instante;
}

function anchoDeTexto(valor: ValorCelda): number {
  if (valor == null) return 0;
  if (valor instanceof Date) return FORMATO_FECHA.length;
  return String(valor).length;
}

/**
 * Añade una pestaña con cabecera fija, bordes finos y anchos calculados.
 * Devuelve la hoja por si el formateador necesita retocar celdas concretas
 * (los colores por estado de la pestaña "Todos", por ejemplo).
 */
export function construirHoja<T>(
  libro: ExcelJS.Workbook,
  nombre: string,
  columnas: ColumnaExcel<T>[],
  filas: T[],
): ExcelJS.Worksheet {
  const hoja = libro.addWorksheet(nombre);

  hoja.columns = columnas.map((columna) => ({
    header: columna.cabecera,
    width: columna.ancho ?? ANCHO_MINIMO,
  }));

  const cabecera = hoja.getRow(1);
  cabecera.font = { bold: true };
  cabecera.alignment = { vertical: "middle" };
  cabecera.eachCell((celda) => {
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GRIS_CABECERA },
    };
    celda.border = BORDE_FINO;
  });

  // Cabecera siempre visible al desplazarse por un volcado largo.
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  const anchos = columnas.map((columna) => columna.cabecera.length);

  for (const fila of filas) {
    const valores = columnas.map((columna) => columna.valor(fila));
    const filaExcel = hoja.addRow(valores);

    columnas.forEach((columna, indice) => {
      const celda = filaExcel.getCell(indice + 1);
      celda.border = BORDE_FINO;

      if (columna.tipo === "numero") {
        celda.numFmt = FORMATO_NUMERO;
      } else if (columna.tipo === "entero") {
        celda.numFmt = FORMATO_ENTERO;
      } else if (columna.tipo === "fecha") {
        celda.numFmt = FORMATO_FECHA;
      } else if (columna.tipo === "texto") {
        // Notas y descripciones pueden traer saltos de línea escritos por
        // Sonia: sin esto Excel los pinta como una sola línea larga.
        celda.alignment = { vertical: "top", wrapText: true };
      }

      anchos[indice] = Math.max(anchos[indice], anchoDeTexto(valores[indice]));
    });
  }

  columnas.forEach((columna, indice) => {
    if (columna.ancho) return;
    hoja.getColumn(indice + 1).width = Math.min(
      ANCHO_MAXIMO,
      Math.max(ANCHO_MINIMO, anchos[indice] + 2),
    );
  });

  return hoja;
}
