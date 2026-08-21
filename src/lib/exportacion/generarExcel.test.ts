// Tests de la exportación a Excel (Prompt 9).
//
// Se genera el .xlsx en memoria y se vuelve a leer con ExcelJS: se comprueba lo
// que acabará viendo Espe al abrir el archivo (pestañas, filas, formatos), no
// la estructura interna del generador.

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  idsAFacturar,
  type DatosExportacion,
  type LineaExport,
  type PresupuestoExport,
} from "./consultas";
import { generarExcel, nombreArchivoExportacion } from "./generarExcel";
import { NOMBRE_HOJA_FACTURABLES } from "./formatoFacturables";
import { NOMBRE_HOJA_TODOS } from "./formatoTodos";
import { NOMBRE_HOJA_LINEAS } from "./formatoDetalleLineas";
import type { EstadoPresupuesto } from "@/types/database";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function presupuesto(
  numero: string,
  estado: EstadoPresupuesto,
  extra: Partial<PresupuestoExport> = {},
): PresupuestoExport {
  return {
    id: `id-${numero}`,
    numero,
    estado,
    fecha_emision: "2026-07-15",
    fecha_aceptacion: estado === "aceptado" ? "2026-07-20" : null,
    fecha_enviado_a_facturacion: null,
    cliente: {
      nombre: "Doyle Náutica S.L.",
      cif: "B07123456",
      direccion: "C/ Moll 12",
      localidad: "Palma",
      provincia: "Illes Balears",
      codigo_postal: "07001",
      email: "info@doyle.example",
      telefono: "971 000 000",
    },
    subtotal: 100,
    descuento_pct: 0,
    descuento_importe: 0,
    transporte: 0,
    base_imponible: 100,
    iva_pct: 21,
    iva_importe: 21,
    total: 121,
    emisor: "Sonia",
    notas: "",
    ...extra,
  };
}

function linea(
  numeroPresupuesto: string,
  extra: Partial<LineaExport> = {},
): LineaExport {
  return {
    numero_presupuesto: numeroPresupuesto,
    estado: "aceptado",
    cliente: "Doyle Náutica S.L.",
    tipo_linea: "tecnica",
    tecnica: "DTF",
    descripcion: "Impresión DTF en pecho",
    cantidad: 120,
    precio_unitario: 0.5,
    importe_linea: 59.54,
    es_composicion_dtf: false,
    orden: 1,
    ...extra,
  };
}

function datos(
  presupuestos: PresupuestoExport[],
  lineas: LineaExport[] = [],
): DatosExportacion {
  return {
    filtro: {
      desde: "2026-07-01",
      hasta: "2026-07-31",
      campo_fecha: "fecha_emision",
    },
    presupuestos,
    lineas,
  };
}

/** Genera el Excel y lo vuelve a abrir, como haría Espe en LibreOffice. */
async function abrirGenerado(
  entrada: DatosExportacion,
): Promise<ExcelJS.Workbook> {
  const buffer = await generarExcel(entrada);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  return libro;
}

function hoja(libro: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const encontrada = libro.getWorksheet(nombre);
  if (!encontrada) throw new Error(`No existe la pestaña "${nombre}"`);
  return encontrada;
}

/** Filas de datos, sin contar la cabecera. */
function filasDeDatos(worksheet: ExcelJS.Worksheet): number {
  return Math.max(0, worksheet.rowCount - 1);
}

function indiceColumna(worksheet: ExcelJS.Worksheet, cabecera: string): number {
  const fila = worksheet.getRow(1);
  for (let columna = 1; columna <= fila.cellCount; columna += 1) {
    if (fila.getCell(columna).value === cabecera) return columna;
  }
  throw new Error(`No existe la columna "${cabecera}"`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generarExcel", () => {
  it("con 0 presupuestos genera las 3 pestañas vacías (solo cabecera)", async () => {
    const libro = await abrirGenerado(datos([]));

    expect(libro.worksheets.map((w) => w.name)).toEqual([
      NOMBRE_HOJA_FACTURABLES,
      NOMBRE_HOJA_TODOS,
      NOMBRE_HOJA_LINEAS,
    ]);

    for (const nombre of [
      NOMBRE_HOJA_FACTURABLES,
      NOMBRE_HOJA_TODOS,
      NOMBRE_HOJA_LINEAS,
    ]) {
      const worksheet = hoja(libro, nombre);
      expect(filasDeDatos(worksheet)).toBe(0);
      // La cabecera sí está, y congelada.
      expect(worksheet.getRow(1).getCell(1).value).toBeTruthy();
      expect(worksheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    }
  });

  it("separa aceptados (pestaña 1) del resto de estados (pestaña 2)", async () => {
    const libro = await abrirGenerado(
      datos([
        presupuesto("2026/000090/0", "aceptado"),
        presupuesto("2026/000091/0", "borrador"),
        presupuesto("2026/000092/0", "aceptado"),
        presupuesto("2026/000093/0", "rechazado"),
      ]),
    );

    const facturables = hoja(libro, NOMBRE_HOJA_FACTURABLES);
    const todos = hoja(libro, NOMBRE_HOJA_TODOS);

    expect(filasDeDatos(facturables)).toBe(2);
    expect(filasDeDatos(todos)).toBe(4);

    // Ordenación de "Facturables": por número ascendente.
    const numero = indiceColumna(facturables, "Número");
    expect(facturables.getRow(2).getCell(numero).value).toBe("2026/000090/0");
    expect(facturables.getRow(3).getCell(numero).value).toBe("2026/000092/0");

    // Y solo aceptados, nunca un borrador o un rechazado.
    const estados = new Set<unknown>();
    const columnaEstado = indiceColumna(todos, "Estado");
    for (let fila = 2; fila <= todos.rowCount; fila += 1) {
      estados.add(todos.getRow(fila).getCell(columnaEstado).value);
    }
    expect(estados).toEqual(new Set(["Aceptado", "Borrador", "Rechazado"]));
  });

  it("marca la composición DTF en la pestaña de líneas", async () => {
    const libro = await abrirGenerado(
      datos(
        [presupuesto("2026/000098/0", "aceptado")],
        [
          linea("2026/000098/0", {
            descripcion: "DTF compuesta (2 logos)",
            es_composicion_dtf: true,
          }),
          linea("2026/000098/0", {
            orden: 2,
            tipo_linea: "extra",
            tecnica: "",
            descripcion: "Vectorización",
          }),
        ],
      ),
    );

    const lineas = hoja(libro, NOMBRE_HOJA_LINEAS);
    const columna = indiceColumna(lineas, "Es composición DTF");

    expect(filasDeDatos(lineas)).toBe(2);
    expect(lineas.getRow(2).getCell(columna).value).toBe("true");
    expect(lineas.getRow(3).getCell(columna).value).toBe("false");
  });

  it("escribe las fechas como fecha real con formato dd/mm/yyyy", async () => {
    const libro = await abrirGenerado(
      datos([presupuesto("2026/000090/0", "aceptado")]),
    );

    const facturables = hoja(libro, NOMBRE_HOJA_FACTURABLES);
    const celda = facturables
      .getRow(2)
      .getCell(indiceColumna(facturables, "Fecha emisión"));

    expect(celda.numFmt).toBe("dd/mm/yyyy");
    expect(celda.value).toBeInstanceOf(Date);
    // Sin desplazamiento por huso horario: el 15 de julio sigue siendo el 15.
    expect((celda.value as Date).toISOString()).toBe("2026-07-15T00:00:00.000Z");

    // Un presupuesto sin aceptar deja la celda de aceptación vacía, no "null".
    const sinAceptar = await abrirGenerado(
      datos([presupuesto("2026/000091/0", "borrador")]),
    );
    const todos = hoja(sinAceptar, NOMBRE_HOJA_TODOS);
    const aceptacion = todos
      .getRow(2)
      .getCell(indiceColumna(todos, "Fecha aceptación")).value;
    expect(aceptacion == null).toBe(true);
  });

  it("respeta los saltos de línea y caracteres especiales de las notas", async () => {
    const notas = 'Entrega en obra — "puerta 3"\nAvisar a Vicente & Sonia';
    const libro = await abrirGenerado(
      datos([presupuesto("2026/000090/0", "aceptado", { notas })]),
    );

    const facturables = hoja(libro, NOMBRE_HOJA_FACTURABLES);
    const celda = facturables
      .getRow(2)
      .getCell(indiceColumna(facturables, "Notas internas"));

    expect(celda.value).toBe(notas);
    expect(celda.alignment?.wrapText).toBe(true);
  });

  it("nombra el archivo con el rango exportado", () => {
    expect(nombreArchivoExportacion("2026-07-01", "2026-07-31")).toBe(
      "Ancora_Exportacion_2026-07-01_a_2026-07-31.xlsx",
    );
  });
});

describe("idsAFacturar", () => {
  it("solo devuelve los aceptados, nunca los otros estados", () => {
    const presupuestos = [
      presupuesto("2026/000090/0", "aceptado"),
      presupuesto("2026/000091/0", "borrador"),
      presupuesto("2026/000092/0", "enviado"),
      presupuesto("2026/000093/0", "rechazado"),
      presupuesto("2026/000094/0", "caducado"),
      presupuesto("2026/000095/0", "aceptado"),
    ];

    expect(idsAFacturar(presupuestos)).toEqual([
      "id-2026/000090/0",
      "id-2026/000095/0",
    ]);
  });

  it("devuelve lista vacía si no hay ningún aceptado", () => {
    expect(idsAFacturar([presupuesto("2026/000091/0", "borrador")])).toEqual([]);
  });
});
