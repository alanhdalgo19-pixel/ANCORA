// F2.3 — integración del mockup en el flujo de la línea:
// wizard → puente (`calcularLinea`) → snapshot `detalle_calculo.mockup` →
// reedición (`reconstruirDatosLinea`) y PDF (`PresupuestoPDF`).
//
// Supabase se sustituye por un doble en memoria con la misma técnica que
// `calcular-linea.test.ts`. El motor de cálculo es el real.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/empresa";
import { PresupuestoPDF } from "@/lib/pdf/PresupuestoPDF";
import { logosIncrustables } from "@/lib/pdf/logos-mockup";
import { calcularLinea, ErrorCalculo } from "@/lib/presupuestos/calcular-linea";
import { reconstruirDatosLinea } from "@/lib/presupuestos/cargar-wizard";
import type { createClient } from "@/lib/supabase/server";
import type { Cliente, Presupuesto } from "@/types/database";
import type { DatosLineaWizard, LineaVista } from "@/types/presupuestos";
import { leerMockupSnapshot, type MockupSnapshot } from "./snapshot";

type SupabaseServerClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Doble de Supabase
// ---------------------------------------------------------------------------

const TABLAS: Record<string, Record<string, unknown>[]> = {
  tecnicas: [
    { id: "tec-dtf", codigo: "DTF" },
    { id: "tec-seri", codigo: "SERIGRAFIA" },
  ],
  tramos_margen: [
    { tecnica_id: "tec-dtf", tipo_cliente: "esporadico", desde_cantidad: 100, hasta_cantidad: 499, margen_pct: 40 },
    { tecnica_id: "tec-seri", tipo_cliente: "esporadico", desde_cantidad: 1, hasta_cantidad: null, margen_pct: 0 },
  ],
  parametros_dtf: [
    {
      ancho_rollo_cm: 35,
      precio_metro: 10,
      recorte_por_logo: 0.1,
      mano_obra_por_minuto: 0.32,
      preparacion_pct: 20,
      minimo_trabajo: 15,
      margen_seguridad_cm: 0.5,
      minutos_setup_fijo: 5,
      minutos_por_logo: 0.1,
    },
  ],
  parametros_serigrafia: [
    {
      vectorizacion: 35,
      recargo_oscura_pecho_por_color: 35,
      recargo_oscura_espalda_por_color: 37,
      fotolito_pecho: 14,
      fotolito_espalda: 19,
      minimo_trabajo: 20,
      pantone_por_color: 25,
    },
  ],
  tarifas_serigrafia: [
    { tipo_cliente: "esporadico", ubicacion: "pecho", num_colores: 1, desde_cantidad: 100, hasta_cantidad: 249, precio_unitario: 1.27 },
  ],
  prendas: [
    { id: "polo-star", nombre: "Polo Star", codigo_interno: "POL-STAR-ROLY", tipo_mockup: "polo" },
    { id: "chaqueta", nombre: "Chaqueta neopreno Antártida", codigo_interno: "CHQ", tipo_mockup: null },
  ],
  precios_prenda: [
    { prenda_id: "polo-star", color_grupo: "color", tipo_cliente: "esporadico", desde_cantidad: 1, hasta_cantidad: null, precio: 4.5 },
    { prenda_id: "chaqueta", color_grupo: "oscuro", tipo_cliente: "esporadico", desde_cantidad: 1, hasta_cantidad: null, precio: 12 },
  ],
  logos_clientes: [
    { id: "logo-h10", nombre: "h10-hotels-logo", formato: "png", cliente_id: "cliente-doyle" },
    { id: "logo-otro", nombre: "ajeno", formato: "png", cliente_id: "cliente-barcelo" },
  ],
};

function supabaseFalso(): SupabaseServerClient {
  function from(tabla: string) {
    const filtros: [string, unknown][] = [];
    const filas = () =>
      (TABLAS[tabla] ?? []).filter((fila) =>
        filtros.every(([campo, valor]) => fila[campo] === valor),
      );

    const api = {
      select: () => api,
      order: () => api,
      limit: () => api,
      eq: (campo: string, valor: unknown) => {
        filtros.push([campo, valor]);
        return api;
      },
      single: async () => ({ data: filas()[0] ?? null }),
      maybeSingle: async () => ({ data: filas()[0] ?? null }),
      then: (resolver: (valor: { data: unknown[] }) => unknown) =>
        resolver({ data: filas() }),
    };
    return api;
  }
  return { from } as unknown as SupabaseServerClient;
}

const CLIENTE_DOYLE = {
  id: "cliente-doyle",
  tipo_cliente: "esporadico",
  descuento_bordado_pct: 0,
} as const;

function lineaDTF(cambios: Partial<DatosLineaWizard> = {}): DatosLineaWizard {
  return {
    cantidad: 120,
    prenda_id: "polo-star",
    color: "azul marino",
    color_grupo: "color",
    detalles: {
      tecnica: "DTF",
      logos: [{ posicion: "pecho", ancho_cm: 9, alto_cm: 4, rotable: false }],
      incluir_vectorizacion: false,
    },
    logo_id: "logo-h10",
    ...cambios,
  };
}

/** Lo que `cargarPresupuestoCompleto` / la edición leerían de la fila guardada. */
function comoFilaGuardada(
  datos: DatosLineaWizard,
  tecnica: Awaited<ReturnType<typeof calcularLinea>>["tecnica"],
) {
  return {
    cantidad: tecnica.cantidad,
    prenda_id: datos.prenda_id,
    color: tecnica.color,
    color_grupo: tecnica.color_grupo,
    ancho_logo_cm: tecnica.ancho_logo_cm,
    alto_logo_cm: tecnica.alto_logo_cm,
    // Ida y vuelta por JSON, como la columna jsonb.
    detalle_calculo: JSON.parse(JSON.stringify(tecnica.detalle_calculo)),
  };
}

// ---------------------------------------------------------------------------

describe("mockup en el snapshot de la línea", () => {
  it("guarda detalle_calculo.mockup al añadir la línea, sin tocar el cálculo", async () => {
    const datos = lineaDTF();
    const linea = await calcularLinea(supabaseFalso(), datos, CLIENTE_DOYLE);
    const snapshot = linea.tecnica.detalle_calculo as Record<string, unknown>;

    const esperado: MockupSnapshot = {
      version: "1.0",
      logo_id: "logo-h10",
      logo_nombre: "h10-hotels-logo",
      logo_formato: "png",
      tipo_prenda: "polo",
      color_prenda: "color",
      logos: [{ ubicacion: "pecho", ancho_cm: 9, alto_cm: 4, rotado: false }],
    };
    expect(snapshot.mockup).toEqual(esperado);

    // Superset: el caso canónico DTF sigue dando 59,54 € y el snapshot del
    // motor conserva sus bloques.
    expect(linea.tecnica.importe_linea).toBe(59.54);
    expect(snapshot.tecnica).toBe("DTF");
    expect(snapshot.calculo).toBeDefined();
    expect(snapshot.wizard).toBeDefined();
  });

  it("composición DTF: guarda todos los logos; un logo rotable NO se gira sobre la prenda", async () => {
    const datos = lineaDTF({
      detalles: {
        tecnica: "DTF",
        logos: [
          { posicion: "pecho", ancho_cm: 9, alto_cm: 4, rotable: false },
          { posicion: "espalda", ancho_cm: 25, alto_cm: 30, rotable: true },
        ],
        incluir_vectorizacion: false,
      },
    });
    const linea = await calcularLinea(supabaseFalso(), datos, CLIENTE_DOYLE);
    const mockup = leerMockupSnapshot(linea.tecnica.detalle_calculo);

    expect(mockup?.logos).toEqual([
      { ubicacion: "pecho", ancho_cm: 9, alto_cm: 4, rotado: false },
      { ubicacion: "espalda", ancho_cm: 25, alto_cm: 30, rotado: false },
    ]);
  });

  it("al reeditar una línea con mockup se restauran el logo y las medidas", async () => {
    const dtf = lineaDTF();
    const lineaDtf = await calcularLinea(supabaseFalso(), dtf, CLIENTE_DOYLE);
    const reeditadaDtf = reconstruirDatosLinea(comoFilaGuardada(dtf, lineaDtf.tecnica));

    expect(reeditadaDtf?.logo_id).toBe("logo-h10");
    expect(reeditadaDtf?.detalles).toEqual(dtf.detalles);

    // Serigrafía: las medidas solo existen para el mockup y también vuelven.
    const serigrafia = lineaDTF({
      detalles: {
        tecnica: "SERIGRAFIA",
        ubicacion: "pecho",
        num_colores: 1,
        prenda_oscura: false,
        trabajo_nuevo: false,
        incluir_vectorizacion: false,
        incluir_pantone: false,
        cantidad_pantones: null,
        ancho_logo_cm: 12,
        alto_logo_cm: 6.5,
      },
    });
    const lineaSeri = await calcularLinea(supabaseFalso(), serigrafia, CLIENTE_DOYLE);
    const reeditadaSeri = reconstruirDatosLinea(
      comoFilaGuardada(serigrafia, lineaSeri.tecnica),
    );

    expect(reeditadaSeri?.detalles).toMatchObject({
      tecnica: "SERIGRAFIA",
      ancho_logo_cm: 12,
      alto_logo_cm: 6.5,
    });
    expect(reeditadaSeri?.logo_id).toBe("logo-h10");
    // El precio de serigrafía no depende del tamaño del logo.
    const sinMedidas = await calcularLinea(
      supabaseFalso(),
      { ...serigrafia, detalles: { ...serigrafia.detalles, ancho_logo_cm: null, alto_logo_cm: null } as DatosLineaWizard["detalles"] },
      CLIENTE_DOYLE,
    );
    expect(sinMedidas.tecnica.importe_linea).toBe(lineaSeri.tecnica.importe_linea);
  });

  it("prenda sin tipo_mockup (null) usa el fallback 'otro'; sin prenda, 'otro' en blanco", async () => {
    const conChaqueta = await calcularLinea(
      supabaseFalso(),
      lineaDTF({ prenda_id: "chaqueta", color_grupo: "oscuro" }),
      CLIENTE_DOYLE,
    );
    expect(leerMockupSnapshot(conChaqueta.tecnica.detalle_calculo)).toMatchObject({
      tipo_prenda: "otro",
      color_prenda: "oscuro",
    });

    const sinPrenda = await calcularLinea(
      supabaseFalso(),
      lineaDTF({ prenda_id: null, color: null, color_grupo: null }),
      CLIENTE_DOYLE,
    );
    expect(leerMockupSnapshot(sinPrenda.tecnica.detalle_calculo)).toMatchObject({
      tipo_prenda: "otro",
      color_prenda: "blanco",
    });
  });

  it("rechaza un logo que no es de la biblioteca del cliente del presupuesto", async () => {
    await expect(
      calcularLinea(supabaseFalso(), lineaDTF({ logo_id: "logo-otro" }), CLIENTE_DOYLE),
    ).rejects.toBeInstanceOf(ErrorCalculo);
  });
});

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const CLIENTE_PDF: Cliente = {
  id: "cliente-doyle",
  nombre: "Doyle Náutica",
  cif: "B07000000",
  email: null,
  telefono: null,
  direccion: null,
  codigo_postal: null,
  localidad: null,
  provincia: "Illes Balears",
  tipo_cliente: "esporadico",
  descuento_bordado_pct: 0,
  persona_contacto: null,
  condiciones_pago: null,
  activo: true,
  created_at: "2026-09-01T09:00:00Z",
};

const PRESUPUESTO_PDF: Presupuesto = {
  id: "presupuesto-mockup",
  numero: "2026/000120/0",
  cliente_id: CLIENTE_PDF.id,
  usuario_id: "usuario-sonia",
  fecha_emision: "2026-09-29",
  fecha_validez: "2026-10-29",
  estado: "borrador",
  subtotal: 59.54,
  base_imponible: 59.54,
  iva_pct: 21,
  iva_importe: 12.5,
  total: 72.04,
  transporte: 0,
  descuento_manual_pct: 0,
  notas: null,
  created_at: "2026-09-29T08:00:00Z",
  sent_at: null,
  accepted_at: null,
  pdf_storage_path: null,
  pdf_regeneracion_pendiente: false,
};

describe("mockup en el PDF", () => {
  it("incrusta el logo PNG del mockup y lista los logos de una composición", async () => {
    const datos = lineaDTF({
      detalles: {
        tecnica: "DTF",
        logos: [
          { posicion: "pecho", ancho_cm: 9, alto_cm: 4, rotable: false },
          { posicion: "espalda", ancho_cm: 25, alto_cm: 30, rotable: false },
        ],
        incluir_vectorizacion: false,
      },
    });
    const calculada = await calcularLinea(supabaseFalso(), datos, CLIENTE_DOYLE);
    const lineas: LineaVista[] = [
      {
        id: "linea-1",
        orden: 2,
        tipo_linea: "tecnica",
        descripcion: calculada.tecnica.descripcion,
        cantidad: 120,
        precio_unitario: calculada.tecnica.precio_unitario,
        importe_linea: calculada.tecnica.importe_linea,
        detalle_calculo: JSON.parse(JSON.stringify(calculada.tecnica.detalle_calculo)),
        linea_padre_id: null,
      },
    ];

    expect(logosIncrustables(lineas)).toEqual(["logo-h10"]);

    // En producción es la URL firmada del bucket. Aquí se pasa el binario de
    // un PNG del repo (react-pdf intentaría descargar una ruta local como URL).
    const png = readFileSync(path.join(process.cwd(), "public", "logo-ancora.png"));
    const renderizar = (logosMockup: Record<string, Buffer>) =>
      renderToBuffer(
        PresupuestoPDF({
          presupuesto: PRESUPUESTO_PDF,
          cliente: CLIENTE_PDF,
          nombreEmisor: "Sonia",
          lineas,
          empresa: EMPRESA,
          logosMockup,
        }),
      );
    const imagenes = (pdf: Buffer) =>
      (pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;

    const conLogo = await renderizar({ "logo-h10": png });
    const sinLogo = await renderizar({});

    expect(conLogo.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // El logo del mockup añade imágenes a las de la cabecera de Ancora.
    expect(imagenes(conLogo)).toBeGreaterThan(imagenes(sinLogo));
    // La lista de logos de la composición sale bajo el mockup. El texto va
    // comprimido en el PDF, así que se comprueba en el snapshot que la genera.
    expect(leerMockupSnapshot(lineas[0].detalle_calculo)?.logos).toHaveLength(2);
  }, 30_000);

  it("un logo en PDF no se incrusta: el mockup se dibuja igual sin romper el documento", async () => {
    const mockup: MockupSnapshot = {
      version: "1.0",
      logo_id: "logo-pdf",
      logo_nombre: "Doyle_verano",
      logo_formato: "pdf",
      tipo_prenda: "sudadera",
      color_prenda: "oscuro",
      logos: [{ ubicacion: "espalda", ancho_cm: 40, alto_cm: 50, rotado: false }],
    };
    const lineas: LineaVista[] = [
      {
        id: "linea-1",
        orden: 1,
        tipo_linea: "tecnica",
        descripcion: "Impresión DTF en espalda",
        cantidad: 50,
        precio_unitario: 3,
        importe_linea: 150,
        detalle_calculo: { tecnica: "DTF", inputs: {}, mockup },
        linea_padre_id: null,
      },
    ];

    expect(logosIncrustables(lineas)).toEqual([]);

    const pdf = await renderToBuffer(
      PresupuestoPDF({
        presupuesto: PRESUPUESTO_PDF,
        cliente: CLIENTE_PDF,
        nombreEmisor: "Sonia",
        lineas,
        empresa: EMPRESA,
      }),
    );
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
