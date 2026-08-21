// Pestaña 3 del Excel: "Detalle líneas" (Prompt 9, apartado G.3).
//
// Una fila por línea de presupuesto, solo de los ACEPTADOS. Sirve para dos
// cosas: cuadrar el importe de cada factura línea a línea y analizar qué
// técnicas se venden más.

import type ExcelJS from "exceljs";
import type { LineaExport } from "./consultas";
import { construirHoja, type ColumnaExcel } from "./estilos";
import type { TipoLinea } from "@/types/database";

export const NOMBRE_HOJA_LINEAS = "Detalle líneas";

const ETIQUETA_TIPO_LINEA: Record<TipoLinea, string> = {
  prenda: "prenda",
  tecnica: "tecnica",
  extra: "extra",
};

function columnasLineas(): ColumnaExcel<LineaExport>[] {
  return [
    { cabecera: "Número presupuesto", valor: (l) => l.numero_presupuesto },
    { cabecera: "Estado", valor: (l) => l.estado },
    { cabecera: "Cliente", valor: (l) => l.cliente },
    {
      cabecera: "Tipo de línea",
      valor: (l) => ETIQUETA_TIPO_LINEA[l.tipo_linea] ?? l.tipo_linea,
    },
    { cabecera: "Técnica", valor: (l) => l.tecnica },
    { cabecera: "Descripción", tipo: "texto", valor: (l) => l.descripcion },
    { cabecera: "Cantidad", tipo: "entero", valor: (l) => l.cantidad },
    {
      cabecera: "Precio unitario",
      tipo: "numero",
      valor: (l) => l.precio_unitario,
    },
    { cabecera: "Importe línea", tipo: "numero", valor: (l) => l.importe_linea },
    {
      cabecera: "Es composición DTF",
      // Se vuelca como texto "true"/"false" y no como booleano de Excel: este
      // último se traduce a VERDADERO/FALSO según el idioma de quien lo abra, y
      // el archivo también lo lee un importador que no entiende de locales.
      valor: (l) => (l.es_composicion_dtf ? "true" : "false"),
    },
  ];
}

/** Añade la pestaña "Detalle líneas" al libro. */
export function construirHojaDetalleLineas(
  libro: ExcelJS.Workbook,
  lineas: LineaExport[],
): ExcelJS.Worksheet {
  const ordenadas = [...lineas].sort((a, b) => {
    const comparacion = a.numero_presupuesto.localeCompare(b.numero_presupuesto);
    return comparacion !== 0 ? comparacion : a.orden - b.orden;
  });

  return construirHoja(libro, NOMBRE_HOJA_LINEAS, columnasLineas(), ordenadas);
}
