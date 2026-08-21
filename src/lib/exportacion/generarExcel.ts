// Ensamblado del .xlsx de exportación (Prompt 9).
//
// Función pura respecto a Supabase: recibe los datos ya cargados por
// `consultas.ts` y devuelve el archivo en memoria. Así se puede probar el
// contenido y el formato del Excel sin base de datos, igual que el motor de
// cálculo (CLAUDE.md sección 11).

import ExcelJS from "exceljs";
import type { DatosExportacion } from "./consultas";
import { construirHojaFacturables } from "./formatoFacturables";
import { construirHojaTodos } from "./formatoTodos";
import { construirHojaDetalleLineas } from "./formatoDetalleLineas";
import { EMPRESA } from "@/lib/empresa";

/**
 * Nombre del archivo que ve Espe al descargar:
 * `Ancora_Exportacion_2026-07-01_a_2026-07-31.xlsx`.
 */
export function nombreArchivoExportacion(desde: string, hasta: string): string {
  return `Ancora_Exportacion_${desde}_a_${hasta}.xlsx`;
}

/**
 * Construye el libro con las tres pestañas.
 *
 * El orden importa: "Facturables" primero porque es la que se importa al
 * software de facturación y la que abre Excel al abrir el archivo.
 */
export async function generarExcel(
  datos: DatosExportacion,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = EMPRESA.nombre_comercial;
  libro.created = new Date();

  construirHojaFacturables(libro, datos.presupuestos);
  construirHojaTodos(libro, datos.presupuestos, datos.filtro.campo_fecha);
  construirHojaDetalleLineas(libro, datos.lineas);

  const contenido = await libro.xlsx.writeBuffer();
  return Buffer.from(contenido);
}
