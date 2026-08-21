// Pestaña 1 del Excel: "Facturables" (Prompt 9, apartado G.1).
//
// Solo presupuestos ACEPTADOS. Es la pestaña pensada para importar al futuro
// software de facturación conforme a Verifactu, así que el formato es genérico:
// una fila por presupuesto, importes como número puro (sin el símbolo €, que
// muchos importadores no saben leer) y datos fiscales del cliente completos.

import type ExcelJS from "exceljs";
import type { PresupuestoExport } from "./consultas";
import { construirHoja, fechaExcel, type ColumnaExcel } from "./estilos";

export const NOMBRE_HOJA_FACTURABLES = "Facturables";

/**
 * Columnas comunes a las pestañas 1 y 2: cabecera del presupuesto, datos
 * fiscales del cliente, desglose de importes y metadatos. La pestaña "Todos"
 * inserta el estado y añade la fecha de volcado alrededor de estas.
 */
export function columnasPresupuesto(): ColumnaExcel<PresupuestoExport>[] {
  return [
    // ── Bloque 1: presupuesto ──────────────────────────────────────
    { cabecera: "Número", valor: (p) => p.numero },
    {
      cabecera: "Fecha emisión",
      tipo: "fecha",
      valor: (p) => fechaExcel(p.fecha_emision),
    },
    {
      cabecera: "Fecha aceptación",
      tipo: "fecha",
      valor: (p) => fechaExcel(p.fecha_aceptacion),
    },

    // ── Bloque 2: cliente ──────────────────────────────────────────
    { cabecera: "Razón social", valor: (p) => p.cliente.nombre },
    { cabecera: "CIF/NIF", valor: (p) => p.cliente.cif },
    { cabecera: "Dirección", valor: (p) => p.cliente.direccion },
    { cabecera: "Localidad", valor: (p) => p.cliente.localidad },
    { cabecera: "Provincia", valor: (p) => p.cliente.provincia },
    { cabecera: "Código postal", valor: (p) => p.cliente.codigo_postal },
    { cabecera: "Email", valor: (p) => p.cliente.email },
    { cabecera: "Teléfono", valor: (p) => p.cliente.telefono },

    // ── Bloque 3: importes ─────────────────────────────────────────
    { cabecera: "Subtotal", tipo: "numero", valor: (p) => p.subtotal },
    { cabecera: "Descuento %", tipo: "numero", valor: (p) => p.descuento_pct },
    {
      cabecera: "Descuento €",
      tipo: "numero",
      valor: (p) => p.descuento_importe,
    },
    { cabecera: "Transporte", tipo: "numero", valor: (p) => p.transporte },
    {
      cabecera: "Base imponible",
      tipo: "numero",
      valor: (p) => p.base_imponible,
    },
    { cabecera: "IVA %", tipo: "numero", valor: (p) => p.iva_pct },
    { cabecera: "IVA €", tipo: "numero", valor: (p) => p.iva_importe },
    { cabecera: "Total", tipo: "numero", valor: (p) => p.total },

    // ── Bloque 4: metadatos ────────────────────────────────────────
    { cabecera: "Emisor", valor: (p) => p.emisor },
    { cabecera: "Notas internas", tipo: "texto", valor: (p) => p.notas },
  ];
}

/** Añade la pestaña "Facturables" al libro. */
export function construirHojaFacturables(
  libro: ExcelJS.Workbook,
  presupuestos: PresupuestoExport[],
): ExcelJS.Worksheet {
  const aceptados = presupuestos
    .filter((presupuesto) => presupuesto.estado === "aceptado")
    .sort((a, b) => a.numero.localeCompare(b.numero));

  return construirHoja(
    libro,
    NOMBRE_HOJA_FACTURABLES,
    columnasPresupuesto(),
    aceptados,
  );
}
