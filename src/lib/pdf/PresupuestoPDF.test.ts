// Smoke test del PDF de presupuesto.
//
// No compara pixel a pixel: comprueba que @react-pdf/renderer maqueta el
// documento sin reventar y produce un PDF válido. Es la red de seguridad de un
// componente que solo se ejecuta en el servidor y cuyo fallo (una prop de
// estilo no soportada, un `Text` con un valor que no es cadena) no aparecería
// hasta que Sonia pulsara "Descargar PDF".
//
// El archivo es `.test.ts` y no `.test.tsx` porque `vitest.config.ts` solo
// incluye `.test.ts`; el componente se invoca como función y devuelve su
// elemento raíz `<Document>`, que es justo lo que espera `renderToBuffer`.

import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/empresa";
import type { Cliente, Presupuesto } from "@/types/database";
import type { LineaVista } from "@/types/presupuestos";
import { PresupuestoPDF } from "./PresupuestoPDF";
import { nombreArchivoPDF, rutaStoragePDF } from "./nombres";
import { estilos } from "./styles";

const CLIENTE: Cliente = {
  id: "cliente-1",
  nombre: "Formentera Lines, S.L.",
  cif: "B07123456",
  email: "pedidos@formenteralines.es",
  telefono: "971 000 111",
  direccion: "C/ del Port 12",
  codigo_postal: "07860",
  localidad: "Sant Francesc",
  provincia: "Illes Balears",
  tipo_cliente: "habitual",
  descuento_bordado_pct: 5,
  persona_contacto: "Marta Ribas",
  condiciones_pago: "Transferencia a 30 días",
  activo: true,
  created_at: "2026-01-10T09:00:00Z",
};

const PRESUPUESTO: Presupuesto = {
  id: "presupuesto-1",
  numero: "2026/000090/0",
  cliente_id: CLIENTE.id,
  usuario_id: "usuario-1",
  fecha_emision: "2026-07-26",
  fecha_validez: "2026-08-25",
  estado: "enviado",
  subtotal: 100,
  base_imponible: 120,
  iva_pct: 21,
  iva_importe: 25.2,
  total: 145.2,
  transporte: 20,
  descuento_manual_pct: 0,
  notas: "Entrega en dos remesas.",
  created_at: "2026-07-26T08:00:00Z",
  sent_at: "2026-07-26T10:00:00Z",
  accepted_at: null,
  pdf_storage_path: null,
  pdf_regeneracion_pendiente: false,
};

const LINEAS: LineaVista[] = [
  {
    id: "linea-prenda",
    orden: 1,
    tipo_linea: "prenda",
    descripcion: "Polo técnico Roly Star — Azul marino",
    cantidad: 50,
    precio_unitario: 1,
    importe_linea: 50,
    detalle_calculo: {
      tipo: "PRENDA",
      version_calculo: "1.0",
      inputs: { color_grupo: "oscuro" },
      calculo: { tramo_cantidad: "50-99" },
    },
    linea_padre_id: null,
  },
  {
    id: "linea-tecnica",
    orden: 2,
    tipo_linea: "tecnica",
    descripcion: "Bordado en pecho sobre Polo técnico Roly Star",
    cantidad: 50,
    precio_unitario: 0.7,
    importe_linea: 35,
    detalle_calculo: {
      tecnica: "BORDADO",
      version_calculo: "1.0",
      inputs: { puntadas: 4200 },
      calculo: { descuento_habitual_pct: 5, aplicado_minimo: false },
    },
    linea_padre_id: null,
  },
  {
    id: "linea-extra",
    orden: 3,
    tipo_linea: "extra",
    descripcion: "Picaje sencillo",
    cantidad: 1,
    precio_unitario: 15,
    importe_linea: 15,
    detalle_calculo: {
      tipo: "EXTRA",
      version_calculo: "1.0",
      origen: "BORDADO",
      descripcion: "Picaje sencillo",
      importe: 15,
    },
    linea_padre_id: "linea-tecnica",
  },
];

function renderizar(
  presupuesto: Presupuesto = PRESUPUESTO,
  cliente: Cliente = CLIENTE,
  lineas: LineaVista[] = LINEAS,
) {
  return renderToBuffer(
    PresupuestoPDF({
      presupuesto,
      cliente,
      lineas,
      nombreEmisor: "Sonia",
      empresa: EMPRESA,
    }),
  );
}

describe("PresupuestoPDF", () => {
  it("genera un PDF válido con líneas, extras y totales", async () => {
    const buffer = await renderizar();

    // Cabecera y marca de fin de fichero del formato PDF.
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-8).toString("latin1")).toContain("%%EOF");
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it("no falla con un presupuesto sin líneas ni datos opcionales", async () => {
    const clienteMinimo: Cliente = {
      ...CLIENTE,
      cif: null,
      email: null,
      telefono: null,
      direccion: null,
      codigo_postal: null,
      localidad: null,
      provincia: null,
      persona_contacto: null,
      condiciones_pago: null,
      activo: false,
    };
    const vacio: Presupuesto = {
      ...PRESUPUESTO,
      estado: "borrador",
      subtotal: 0,
      base_imponible: 0,
      iva_importe: 0,
      total: 0,
      transporte: 0,
      notas: null,
    };

    const buffer = await renderizar(vacio, clienteMinimo, []);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);

  it("renderiza también con descuento manual aplicado", async () => {
    const conDescuento: Presupuesto = {
      ...PRESUPUESTO,
      descuento_manual_pct: 10,
      base_imponible: 110,
      iva_importe: 23.1,
      total: 133.1,
    };

    const buffer = await renderizar(conDescuento);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);

  it("embebe el logo oficial como imagen del documento", async () => {
    // El logo dejó de ser un placeholder dibujado con `View`/`Text` en el
    // Patch 7A: si `public/logo-ancora.png` desapareciera o `Image` dejara de
    // aceptar el buffer, el PDF saldría sin marca y nadie se enteraría.
    const pdf = (await renderizar()).toString("latin1");

    expect(pdf).toMatch(/\/Subtype\s*\/Image/);
    expect(pdf).toMatch(/\/Width\s+569/);
    expect(pdf).toMatch(/\/Height\s+158/);
  }, 30_000);
});

describe("cabecera: el número no se solapa con el título (CLAUDE.md 13.8)", () => {
  // Regresión del bug corregido en el Patch 7A. El número se pinta justo debajo
  // del título, así que la caja de línea del título más su margen tienen que
  // caber antes: si alguien vuelve a subir `fontSize` o quita el `lineHeight`
  // explícito, el número se monta encima de la última letra.
  const alturaTitulo = estilos.titulo.fontSize! * estilos.titulo.lineHeight!;

  it("la caja del título cabe en el hueco reservado sobre el número", () => {
    expect(alturaTitulo).toBeLessThanOrEqual(22);
  });

  it("el número deja separación visible bajo el título", () => {
    expect(estilos.numero.marginTop!).toBeGreaterThanOrEqual(5);
  });
});

describe("nombres de archivo", () => {
  it("convierte el número de presupuesto en un nombre de archivo válido", () => {
    expect(nombreArchivoPDF("2026/000090/0")).toBe(
      "Ancora_Presupuesto_2026-000090-0.pdf",
    );
  });

  it("archiva por año dentro del bucket", () => {
    expect(rutaStoragePDF("2026/000090/0")).toBe(
      "2026/Ancora_Presupuesto_2026-000090-0.pdf",
    );
  });
});
