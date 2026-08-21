// Pestaña 2 del Excel: "Todos" (Prompt 9, apartado G.2).
//
// Los cinco estados del rango, para análisis interno de Espe: cuántos
// presupuestos se aceptan, cuántos se rechazan y cuánto importe queda en
// borrador. Mismas columnas que "Facturables" más el estado (coloreado) y la
// fecha del último volcado a facturación.

import type ExcelJS from "exceljs";
import type { PresupuestoExport } from "./consultas";
import { construirHoja, fechaExcel, type ColumnaExcel } from "./estilos";
import { columnasPresupuesto } from "./formatoFacturables";
import type { EstadoPresupuesto } from "@/types/database";

export const NOMBRE_HOJA_TODOS = "Todos";

/** Etiqueta legible del estado; en el Excel no se abrevia. */
const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  caducado: "Caducado",
};

/** Colores de la columna "Estado" (ARGB, como los pide ExcelJS). */
const COLOR_ESTADO: Record<EstadoPresupuesto, { fondo: string; texto: string }> =
  {
    aceptado: { fondo: "FFD4EDDA", texto: "FF155724" },
    enviado: { fondo: "FFCCE5FF", texto: "FF004085" },
    borrador: { fondo: "FFE2E3E5", texto: "FF383D41" },
    rechazado: { fondo: "FFF8D7DA", texto: "FF721C24" },
    caducado: { fondo: "FFFFF3CD", texto: "FF856404" },
  };

/** Índice (1-based) de la columna "Estado" dentro de la hoja. */
const COLUMNA_ESTADO = 2;

function columnasTodos(): ColumnaExcel<PresupuestoExport>[] {
  const comunes = columnasPresupuesto();
  const [numero, ...resto] = comunes;

  return [
    numero,
    {
      cabecera: "Estado",
      valor: (presupuesto) => ETIQUETA_ESTADO[presupuesto.estado],
    },
    ...resto,
    {
      cabecera: "Enviado a facturación",
      tipo: "fecha",
      valor: (presupuesto) =>
        fechaExcel(presupuesto.fecha_enviado_a_facturacion),
    },
  ];
}

/**
 * Fecha por la que se ordena la pestaña: la misma que se usó para filtrar, de
 * modo que el orden que ve Espe coincide con el criterio que eligió.
 */
function fechaOrden(
  presupuesto: PresupuestoExport,
  campoFecha: "fecha_emision" | "accepted_at",
): string {
  return campoFecha === "fecha_emision"
    ? presupuesto.fecha_emision
    : (presupuesto.fecha_aceptacion ?? "");
}

/** Añade la pestaña "Todos" al libro, con el estado coloreado. */
export function construirHojaTodos(
  libro: ExcelJS.Workbook,
  presupuestos: PresupuestoExport[],
  campoFecha: "fecha_emision" | "accepted_at",
): ExcelJS.Worksheet {
  const ordenados = [...presupuestos].sort((a, b) => {
    const comparacion = fechaOrden(b, campoFecha).localeCompare(
      fechaOrden(a, campoFecha),
    );
    // Desempate por número descendente: dos presupuestos del mismo día salen
    // siempre en el mismo orden (la exportación tiene que ser reproducible).
    return comparacion !== 0 ? comparacion : b.numero.localeCompare(a.numero);
  });

  const hoja = construirHoja(
    libro,
    NOMBRE_HOJA_TODOS,
    columnasTodos(),
    ordenados,
  );

  ordenados.forEach((presupuesto, indice) => {
    const colores = COLOR_ESTADO[presupuesto.estado];
    // +2: la fila 1 es la cabecera y `indice` empieza en 0.
    const celda = hoja.getRow(indice + 2).getCell(COLUMNA_ESTADO);
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colores.fondo },
    };
    celda.font = { color: { argb: colores.texto }, bold: true };
  });

  return hoja;
}
