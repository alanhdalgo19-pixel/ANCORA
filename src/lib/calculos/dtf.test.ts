import { describe, expect, it } from "vitest";

import { calcularDTF, type DtfConfig, type DtfInput } from "./dtf";
import type { TramoMargen } from "./types";

// Márgenes DTF sembrados en `tramos_margen` (scripts/seed_admin_data.mjs).
const TRAMOS_DTF: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 60 },
  { desde: 20, hasta: 99, margen_pct: 50 },
  { desde: 100, hasta: 499, margen_pct: 40 },
  { desde: 500, hasta: null, margen_pct: 30 },
];

// Parámetros reales de `parametros_dtf` (confirmados por Espe).
const CONFIG: DtfConfig = {
  ancho_rollo_cm: 35,
  precio_metro: 10,
  recorte_por_logo: 0.1,
  mano_obra_por_minuto: 0.32,
  preparacion_pct: 20,
  minimo_trabajo: 15,
  margen_seguridad_cm: 0.5,
  minutos_setup_fijo: 5,
  minutos_por_logo: 0.1,
  tramos_margen: TRAMOS_DTF,
};

const INPUT_BASE: DtfInput = {
  cantidad: 120,
  ancho_logo_cm: 9,
  alto_logo_cm: 4,
  posicion: "pecho",
  tipo_cliente: "esporadico",
};

describe("calcularDTF — caso canónico de CLAUDE.md 7.2 (120 uds, logo 9×4)", () => {
  const resultado = calcularDTF(INPUT_BASE, CONFIG);
  const calculo = resultado.detalle_calculo.calculo;

  it("coloca 3 logos por fila: floor((35 - 0.5) / (9 + 0.5))", () => {
    expect(calculo.logos_por_fila).toBe(3);
  });

  it("necesita 40 filas: ceil(120 / 3)", () => {
    expect(calculo.filas_necesarias).toBe(40);
  });

  it("consume 1.80 m de rollo: (40 * 4.5) / 100", () => {
    expect(calculo.metros_necesarios).toBeCloseTo(1.8, 2);
  });

  it("gasta 18.00 € de material: 1.80 * 10", () => {
    expect(calculo.material).toBeCloseTo(18.0, 2);
  });

  it("gasta 12.00 € de recorte: 120 * 0.10", () => {
    expect(calculo.recorte).toBeCloseTo(12.0, 2);
  });

  it("estima 17 minutos: 5 + 0.1 * 120", () => {
    expect(calculo.minutos_estimados).toBe(17);
  });

  it("gasta 5.44 € de mano de obra: 17 * 0.32", () => {
    expect(calculo.mano_obra).toBeCloseTo(5.44, 2);
  });

  it("suma 35.44 € antes de preparación", () => {
    expect(calculo.subtotal_sin_preparacion).toBeCloseTo(35.44, 2);
  });

  it("añade 7.09 € de preparación: 35.44 * 20%", () => {
    expect(calculo.preparacion).toBeCloseTo(7.09, 2);
  });

  it("da un coste interno de 42.53 €", () => {
    expect(resultado.coste_interno).toBeCloseTo(42.53, 2);
  });

  it("no aplica el mínimo de trabajo", () => {
    expect(resultado.aplicado_minimo).toBe(false);
  });

  it("aplica el margen del 40% (tramo 100-499)", () => {
    expect(resultado.margen_aplicado_pct).toBe(40);
    expect(resultado.detalle_calculo.comercial.tramo_cantidad).toBe("100-499");
  });

  it("factura 59.54 € de línea: 42.53 * 1.40", () => {
    expect(resultado.importe_linea).toBeCloseTo(59.54, 2);
  });

  it("muestra 0.50 €/ud: 59.54 / 120", () => {
    expect(resultado.precio_unitario).toBeCloseTo(0.5, 2);
  });

  it("no genera extras si no hay vectorización", () => {
    expect(resultado.extras).toEqual([]);
  });
});

describe("calcularDTF — mínimo de trabajo", () => {
  const resultado = calcularDTF(
    { ...INPUT_BASE, cantidad: 5, ancho_logo_cm: 8 },
    CONFIG,
  );

  it("eleva el coste interno hasta los 15 € del mínimo", () => {
    expect(resultado.coste_interno).toBe(15);
  });

  it("marca aplicado_minimo en el resultado y en el snapshot", () => {
    expect(resultado.aplicado_minimo).toBe(true);
    expect(resultado.detalle_calculo.calculo.aplicado_minimo).toBe(true);
  });

  it("aplica el margen del 60% sobre el mínimo (tramo 1-19): 24 €", () => {
    expect(resultado.margen_aplicado_pct).toBe(60);
    expect(resultado.importe_linea).toBeCloseTo(24.0, 2);
  });
});

describe("calcularDTF — cantidad grande (tramo 500+)", () => {
  const resultado = calcularDTF(
    { ...INPUT_BASE, cantidad: 1000, ancho_logo_cm: 8 },
    CONFIG,
  );

  it("aplica el margen del 30%", () => {
    expect(resultado.margen_aplicado_pct).toBe(30);
    expect(resultado.detalle_calculo.comercial.tramo_cantidad).toBe("500+");
  });

  it("no aplica el mínimo con volumen alto", () => {
    expect(resultado.aplicado_minimo).toBe(false);
  });

  it("mantiene coherencia: coste * 1.30 = importe de línea", () => {
    expect(resultado.importe_linea).toBeCloseTo(
      resultado.coste_interno * 1.3,
      2,
    );
  });

  it("abarata el unitario respecto al pedido de 120 uds", () => {
    const pequeno = calcularDTF(INPUT_BASE, CONFIG);
    expect(resultado.precio_unitario).toBeLessThan(pequeno.precio_unitario);
  });
});

describe("calcularDTF — validaciones", () => {
  it("lanza si el logo es más ancho que el rollo", () => {
    expect(() =>
      calcularDTF({ ...INPUT_BASE, ancho_logo_cm: 40 }, CONFIG),
    ).toThrow(/demasiado ancho para el rollo/);
  });

  it("lanza si la cantidad es cero", () => {
    expect(() => calcularDTF({ ...INPUT_BASE, cantidad: 0 }, CONFIG)).toThrow(
      /mayor que cero/,
    );
  });

  it("lanza si las medidas del logo son cero", () => {
    expect(() =>
      calcularDTF({ ...INPUT_BASE, alto_logo_cm: 0 }, CONFIG),
    ).toThrow(/medidas del logo/);
  });

  it("lanza si se pide vectorización sin precio", () => {
    expect(() =>
      calcularDTF({ ...INPUT_BASE, incluir_vectorizacion: true }, CONFIG),
    ).toThrow(/precio de vectorización/);
  });
});

describe("calcularDTF — vectorización como extra", () => {
  const resultado = calcularDTF(
    {
      ...INPUT_BASE,
      incluir_vectorizacion: true,
      precio_vectorizacion: 37,
    },
    CONFIG,
  );

  it("añade el extra con su importe", () => {
    expect(resultado.extras).toEqual([
      { descripcion: "Vectorización", importe: 37 },
    ]);
  });

  it("NO suma el extra al importe de línea (va en línea aparte)", () => {
    expect(resultado.importe_linea).toBeCloseTo(59.54, 2);
  });

  it("refleja el extra en el snapshot comercial", () => {
    expect(resultado.detalle_calculo.comercial.extras).toHaveLength(1);
  });
});

describe("calcularDTF — snapshot inmutable (CLAUDE.md 7.6)", () => {
  const snapshot = calcularDTF(INPUT_BASE, CONFIG).detalle_calculo;

  it("identifica técnica y versión de cálculo", () => {
    expect(snapshot.tecnica).toBe("DTF");
    expect(snapshot.version_calculo).toBe("1.0");
  });

  it("guarda los inputs de la operadora", () => {
    expect(snapshot.inputs).toMatchObject({
      cantidad: 120,
      ancho_logo_cm: 9,
      alto_logo_cm: 4,
      posicion: "pecho",
    });
  });

  it("guarda todos los parámetros de tarifa aplicados", () => {
    expect(Object.keys(snapshot.parametros_aplicados).sort()).toEqual([
      "ancho_rollo_cm",
      "mano_obra_por_minuto",
      "margen_seguridad_cm",
      "minimo_trabajo",
      "minutos_por_logo",
      "minutos_setup_fijo",
      "precio_metro",
      "preparacion_pct",
      "recorte_por_logo",
    ]);
  });

  it("guarda todos los campos del bloque de cálculo", () => {
    expect(Object.keys(snapshot.calculo).sort()).toEqual([
      "aplicado_minimo",
      "coste_interno",
      "filas_necesarias",
      "logos_por_fila",
      "mano_obra",
      "material",
      "metros_necesarios",
      "minutos_estimados",
      "preparacion",
      "recorte",
      "subtotal_sin_preparacion",
    ]);
  });

  it("guarda todos los campos del bloque comercial", () => {
    expect(Object.keys(snapshot.comercial).sort()).toEqual([
      "extras",
      "margen_pct",
      "precio_pre_extras",
      "precio_unitario",
      "tipo_cliente",
      "tramo_cantidad",
    ]);
  });

  it("es serializable a JSON sin pérdida (va a una columna jsonb)", () => {
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("el desglose cuadra: material + recorte + mano_obra = subtotal", () => {
    const c = snapshot.calculo;
    expect(c.material + c.recorte + c.mano_obra).toBeCloseTo(
      c.subtotal_sin_preparacion,
      2,
    );
  });
});
