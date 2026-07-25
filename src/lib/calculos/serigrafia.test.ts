import { describe, expect, it } from "vitest";

import {
  calcularSerigrafia,
  type FilaTarifaSerigrafia,
  type SerigrafiaConfig,
  type SerigrafiaInput,
} from "./serigrafia";
import type { TramoMargen } from "./types";

// Márgenes SERIGRAFIA sembrados en `tramos_margen`.
const TRAMOS_SERIGRAFIA: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 50 },
  { desde: 20, hasta: 99, margen_pct: 40 },
  { desde: 100, hasta: 499, margen_pct: 30 },
  { desde: 500, hasta: null, margen_pct: 20 },
];

// Tarifas reales de `tarifas_serigrafia` (confirmadas por Espe).
const TARIFA_ESPORADICO: FilaTarifaSerigrafia[] = [
  { ubicacion: "pecho", num_colores: 1, desde: 1, hasta: 50, precio: 1.8 },
  { ubicacion: "pecho", num_colores: 1, desde: 51, hasta: 100, precio: 1.27 },
  { ubicacion: "pecho", num_colores: 1, desde: 101, hasta: 150, precio: 1.15 },
  { ubicacion: "pecho", num_colores: 1, desde: 151, hasta: 200, precio: 0.95 },
  { ubicacion: "pecho", num_colores: 1, desde: 201, hasta: 300, precio: 0.75 },
  { ubicacion: "pecho", num_colores: 2, desde: 1, hasta: 50, precio: 2.1 },
  { ubicacion: "pecho", num_colores: 2, desde: 51, hasta: 100, precio: 1.9 },
  { ubicacion: "pecho", num_colores: 2, desde: 101, hasta: 150, precio: 1.73 },
  { ubicacion: "espalda", num_colores: 1, desde: 51, hasta: 100, precio: 1.85 },
  { ubicacion: "espalda", num_colores: 2, desde: 51, hasta: 100, precio: 2.77 },
];

const TARIFA_HABITUAL: FilaTarifaSerigrafia[] = [
  { ubicacion: "pecho", num_colores: 1, desde: 1, hasta: 50, precio: 1.32 },
  { ubicacion: "pecho", num_colores: 1, desde: 51, hasta: 100, precio: 1.21 },
  { ubicacion: "pecho", num_colores: 1, desde: 101, hasta: 150, precio: 1.1 },
  { ubicacion: "pecho", num_colores: 2, desde: 51, hasta: 100, precio: 1.81 },
];

// Parámetros reales de `parametros_serigrafia`.
function configCon(tarifa: FilaTarifaSerigrafia[]): SerigrafiaConfig {
  return {
    tarifa,
    recargo_oscura_pecho_por_color: 35,
    recargo_oscura_espalda_por_color: 37,
    fotolito_pecho: 14,
    fotolito_espalda: 19,
    minimo_trabajo: 20,
    pantone_por_color: 25,
    vectorizacion: 35,
    tramos_margen: TRAMOS_SERIGRAFIA,
  };
}

const INPUT_BASE: SerigrafiaInput = {
  cantidad: 100,
  num_colores: 1,
  ubicacion: "pecho",
  prenda_oscura: false,
  tipo_cliente: "esporadico",
};

describe("calcularSerigrafia — cliente esporádico, pecho 1 color, 100 uds", () => {
  const resultado = calcularSerigrafia(INPUT_BASE, configCon(TARIFA_ESPORADICO));

  it("toma 1.27 €/ud del tramo 51-100", () => {
    expect(resultado.detalle_calculo.calculo.precio_unitario_tarifa).toBe(1.27);
    expect(resultado.detalle_calculo.calculo.tramo_tarifa).toBe("51-100");
  });

  it("suma 127 € de subtotal", () => {
    expect(resultado.detalle_calculo.calculo.subtotal_tarifa).toBeCloseTo(
      127,
      2,
    );
  });

  it("no aplica recargo por prenda oscura", () => {
    expect(resultado.detalle_calculo.calculo.recargo_oscura).toBe(0);
  });

  it("aplica el margen del 30% (tramo 100-499): 165.10 €", () => {
    expect(resultado.margen_aplicado_pct).toBe(30);
    expect(resultado.importe_linea).toBeCloseTo(165.1, 2);
  });

  it("muestra 1.65 €/ud", () => {
    expect(resultado.precio_unitario).toBeCloseTo(1.65, 2);
  });

  it("no genera extras sin trabajo nuevo", () => {
    expect(resultado.extras).toEqual([]);
  });
});

describe("calcularSerigrafia — cliente habitual con los mismos parámetros", () => {
  const habitual = calcularSerigrafia(
    { ...INPUT_BASE, tipo_cliente: "habitual" },
    configCon(TARIFA_HABITUAL),
  );
  const esporadico = calcularSerigrafia(
    INPUT_BASE,
    configCon(TARIFA_ESPORADICO),
  );

  it("toma 1.21 €/ud de la tarifa habitual", () => {
    expect(habitual.detalle_calculo.calculo.precio_unitario_tarifa).toBe(1.21);
  });

  it("suma 121 € de subtotal y 157.30 € con margen del 30%", () => {
    expect(habitual.detalle_calculo.calculo.subtotal_tarifa).toBeCloseTo(121, 2);
    expect(habitual.importe_linea).toBeCloseTo(157.3, 2);
  });

  it("sale más barato que el esporádico", () => {
    expect(habitual.importe_linea).toBeLessThan(esporadico.importe_linea);
  });

  it("registra el tipo de cliente en el snapshot", () => {
    expect(habitual.detalle_calculo.comercial.tipo_cliente).toBe("habitual");
  });
});

describe("calcularSerigrafia — prenda oscura, pecho 2 colores", () => {
  const resultado = calcularSerigrafia(
    { ...INPUT_BASE, num_colores: 2, prenda_oscura: true },
    configCon(TARIFA_ESPORADICO),
  );

  it("suma 70 € de recargo: 2 colores × 35 €", () => {
    expect(resultado.detalle_calculo.calculo.recargo_oscura).toBeCloseTo(70, 2);
  });

  it("añade el recargo al subtotal ANTES del margen: 190 + 70 = 260 €", () => {
    expect(resultado.detalle_calculo.calculo.subtotal_tarifa).toBeCloseTo(
      190,
      2,
    );
    expect(resultado.detalle_calculo.calculo.subtotal_con_recargo).toBeCloseTo(
      260,
      2,
    );
    expect(resultado.importe_linea).toBeCloseTo(338, 2);
  });

  it("usa el recargo de espalda (37 €) cuando la ubicación es espalda", () => {
    const espalda = calcularSerigrafia(
      {
        ...INPUT_BASE,
        ubicacion: "espalda",
        num_colores: 2,
        prenda_oscura: true,
      },
      configCon(TARIFA_ESPORADICO),
    );
    expect(espalda.detalle_calculo.calculo.recargo_oscura).toBeCloseTo(74, 2);
  });
});

describe("calcularSerigrafia — mínimo de trabajo de 20 €", () => {
  // 5 uds × 1.80 € = 9 €, por debajo del mínimo.
  const resultado = calcularSerigrafia(
    { ...INPUT_BASE, cantidad: 5 },
    configCon(TARIFA_ESPORADICO),
  );

  it("eleva el coste interno hasta 20 €", () => {
    expect(resultado.detalle_calculo.calculo.subtotal_con_recargo).toBeCloseTo(
      9,
      2,
    );
    expect(resultado.coste_interno).toBe(20);
    expect(resultado.aplicado_minimo).toBe(true);
  });

  it("aplica el margen del 50% sobre el mínimo (tramo 1-19): 30 €", () => {
    expect(resultado.importe_linea).toBeCloseTo(30, 2);
  });
});

describe("calcularSerigrafia — extras de trabajo nuevo", () => {
  const resultado = calcularSerigrafia(
    {
      ...INPUT_BASE,
      num_colores: 2,
      trabajo_nuevo: true,
      incluir_vectorizacion: true,
      incluir_pantone: true,
    },
    configCon(TARIFA_ESPORADICO),
  );

  it("cobra fotolitos por color: 2 × 14 € en pecho", () => {
    expect(resultado.extras[0].importe).toBeCloseTo(28, 2);
    expect(resultado.extras[0].descripcion).toMatch(/Fotolitos/);
  });

  it("cobra la vectorización una sola vez: 35 €", () => {
    expect(resultado.extras[1]).toEqual({
      descripcion: "Vectorización",
      importe: 35,
    });
  });

  it("cobra un pantone por color por defecto: 2 × 25 €", () => {
    expect(resultado.extras[2].importe).toBeCloseTo(50, 2);
  });

  it("respeta cantidad_pantones cuando se indica", () => {
    const unPantone = calcularSerigrafia(
      {
        ...INPUT_BASE,
        num_colores: 2,
        incluir_pantone: true,
        cantidad_pantones: 1,
      },
      configCon(TARIFA_ESPORADICO),
    );
    expect(unPantone.extras[0].importe).toBeCloseTo(25, 2);
  });

  it("usa el fotolito de espalda (19 €) cuando corresponde", () => {
    const espalda = calcularSerigrafia(
      { ...INPUT_BASE, ubicacion: "espalda", trabajo_nuevo: true },
      configCon(TARIFA_ESPORADICO),
    );
    expect(espalda.extras[0].importe).toBeCloseTo(19, 2);
  });

  it("NO suma ningún extra al importe de línea", () => {
    const sinExtras = calcularSerigrafia(
      { ...INPUT_BASE, num_colores: 2 },
      configCon(TARIFA_ESPORADICO),
    );
    expect(resultado.importe_linea).toBe(sinExtras.importe_linea);
  });
});

describe("calcularSerigrafia — errores", () => {
  it("lanza con 3 colores (máximo 2 soportado)", () => {
    expect(() =>
      calcularSerigrafia(
        { ...INPUT_BASE, num_colores: 3 as 1 | 2 },
        configCon(TARIFA_ESPORADICO),
      ),
    ).toThrow(/Máximo 2 colores/);
  });

  it("lanza si la cantidad queda fuera de todos los tramos de la tarifa", () => {
    // La tarifa de Ancora llega hasta 300 uds.
    expect(() =>
      calcularSerigrafia(
        { ...INPUT_BASE, cantidad: 500 },
        configCon(TARIFA_ESPORADICO),
      ),
    ).toThrow(/No hay tarifa aplicable/);
  });

  it("lanza si no existe la combinación ubicación/colores", () => {
    expect(() =>
      calcularSerigrafia(
        { ...INPUT_BASE, ubicacion: "espalda", cantidad: 10 },
        configCon(TARIFA_ESPORADICO),
      ),
    ).toThrow(/No hay tarifa aplicable/);
  });

  it("lanza si la cantidad es cero", () => {
    expect(() =>
      calcularSerigrafia(
        { ...INPUT_BASE, cantidad: 0 },
        configCon(TARIFA_ESPORADICO),
      ),
    ).toThrow(/mayor que cero/);
  });
});

describe("calcularSerigrafia — snapshot", () => {
  const snapshot = calcularSerigrafia(
    INPUT_BASE,
    configCon(TARIFA_ESPORADICO),
  ).detalle_calculo;

  it("identifica la técnica SERIGRAFIA", () => {
    expect(snapshot.tecnica).toBe("SERIGRAFIA");
    expect(snapshot.version_calculo).toBe("1.0");
  });

  it("es serializable a JSON sin pérdida", () => {
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
