import { describe, expect, it } from "vitest";

import {
  calcularImpresionDirecta,
  type ImpresionDirectaConfig,
  type ImpresionDirectaInput,
} from "./impresion-directa";
import {
  calcularSerigrafia,
  type FilaTarifaSerigrafia,
  type SerigrafiaConfig,
} from "./serigrafia";
import type { TramoMargen } from "./types";

// Subconjunto de `tarifas_serigrafia` (esporádico), que impresión directa
// reutiliza tal cual según CLAUDE.md sección 7.5.
const TARIFA_ESPORADICO: FilaTarifaSerigrafia[] = [
  { ubicacion: "pecho", num_colores: 1, desde: 1, hasta: 50, precio: 1.8 },
  { ubicacion: "pecho", num_colores: 1, desde: 51, hasta: 100, precio: 1.27 },
  { ubicacion: "pecho", num_colores: 2, desde: 51, hasta: 100, precio: 1.9 },
];

// Márgenes IMPRESION_DIRECTA sembrados en `tramos_margen`.
const TRAMOS_ID: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 55 },
  { desde: 20, hasta: 99, margen_pct: 45 },
  { desde: 100, hasta: 499, margen_pct: 35 },
  { desde: 500, hasta: null, margen_pct: 25 },
];

// Márgenes de serigrafía, para el test de equivalencia.
const TRAMOS_SERIGRAFIA: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 50 },
  { desde: 20, hasta: 99, margen_pct: 40 },
  { desde: 100, hasta: 499, margen_pct: 30 },
  { desde: 500, hasta: null, margen_pct: 20 },
];

const CONFIG: ImpresionDirectaConfig = {
  tarifa: TARIFA_ESPORADICO,
  recargo_oscura_pecho_por_color: 35,
  recargo_oscura_espalda_por_color: 37,
  minimo_trabajo: 15, // propio de impresión directa, no los 20 € de serigrafía
  vectorizacion: 35,
  tramos_margen: TRAMOS_ID,
};

const INPUT_BASE: ImpresionDirectaInput = {
  cantidad: 100,
  num_colores: 1,
  ubicacion: "pecho",
  prenda_oscura: false,
  tipo_cliente: "esporadico",
};

describe("calcularImpresionDirecta — equivalencia con serigrafía sin extras", () => {
  // Igualando mínimo de trabajo y tramos, el cálculo base debe coincidir
  // céntimo a céntimo con serigrafía llamada sin trabajo_nuevo ni pantone.
  const configSerigrafia: SerigrafiaConfig = {
    tarifa: TARIFA_ESPORADICO,
    recargo_oscura_pecho_por_color: 35,
    recargo_oscura_espalda_por_color: 37,
    fotolito_pecho: 14,
    fotolito_espalda: 19,
    minimo_trabajo: 20,
    pantone_por_color: 25,
    vectorizacion: 35,
    tramos_margen: TRAMOS_SERIGRAFIA,
  };

  const serigrafia = calcularSerigrafia(
    {
      cantidad: 100,
      num_colores: 1,
      ubicacion: "pecho",
      prenda_oscura: false,
      tipo_cliente: "esporadico",
    },
    configSerigrafia,
  );

  const impresion = calcularImpresionDirecta(INPUT_BASE, {
    ...CONFIG,
    minimo_trabajo: 20,
    tramos_margen: TRAMOS_SERIGRAFIA,
  });

  it("da el mismo bloque de cálculo", () => {
    expect(impresion.detalle_calculo.calculo).toEqual(
      serigrafia.detalle_calculo.calculo,
    );
  });

  it("da el mismo importe de línea y precio unitario", () => {
    expect(impresion.importe_linea).toBe(serigrafia.importe_linea);
    expect(impresion.precio_unitario).toBe(serigrafia.precio_unitario);
  });

  it("aplica sus propios márgenes cuando se usa la config real", () => {
    // Con los tramos reales de IMPRESION_DIRECTA el margen es 35%, no 30%.
    const real = calcularImpresionDirecta(INPUT_BASE, CONFIG);
    expect(real.margen_aplicado_pct).toBe(35);
    expect(real.importe_linea).toBeCloseTo(171.45, 2); // 127 * 1.35
  });
});

describe("calcularImpresionDirecta — nunca cobra fotolitos ni pantones", () => {
  const resultado = calcularImpresionDirecta(
    { ...INPUT_BASE, num_colores: 2, trabajo_nuevo: true },
    CONFIG,
  );

  it("no añade extras aunque el trabajo sea nuevo", () => {
    expect(resultado.extras).toEqual([]);
  });

  it("no menciona fotolitos en ningún extra", () => {
    const descripciones = resultado.extras.map((e) => e.descripcion).join(" ");
    expect(descripciones).not.toMatch(/Fotolito/i);
    expect(descripciones).not.toMatch(/antone/);
  });

  it("sí permite cobrar la vectorización", () => {
    const conVector = calcularImpresionDirecta(
      { ...INPUT_BASE, trabajo_nuevo: true, incluir_vectorizacion: true },
      CONFIG,
    );
    expect(conVector.extras).toEqual([
      { descripcion: "Vectorización", importe: 35 },
    ]);
  });
});

describe("calcularImpresionDirecta — snapshot", () => {
  const snapshot = calcularImpresionDirecta(INPUT_BASE, CONFIG).detalle_calculo;

  it("marca la técnica como IMPRESION_DIRECTA, no SERIGRAFIA", () => {
    expect(snapshot.tecnica).toBe("IMPRESION_DIRECTA");
    expect(snapshot.tecnica).not.toBe("SERIGRAFIA");
  });

  it("no guarda parámetros de fotolito ni pantone", () => {
    expect(snapshot.parametros_aplicados).not.toHaveProperty("fotolito_pecho");
    expect(snapshot.parametros_aplicados).not.toHaveProperty(
      "pantone_por_color",
    );
  });

  it("deja constancia de que reutiliza la tarifa de serigrafía", () => {
    expect(snapshot.parametros_aplicados.usa_tarifa_serigrafia).toBe(true);
  });

  it("es serializable a JSON sin pérdida", () => {
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("calcularImpresionDirecta — reglas heredadas de serigrafía", () => {
  it("aplica su mínimo de trabajo de 15 €", () => {
    const resultado = calcularImpresionDirecta(
      { ...INPUT_BASE, cantidad: 5 },
      CONFIG,
    );
    expect(resultado.coste_interno).toBe(15);
    expect(resultado.aplicado_minimo).toBe(true);
  });

  it("aplica el recargo por prenda oscura", () => {
    const resultado = calcularImpresionDirecta(
      { ...INPUT_BASE, prenda_oscura: true },
      CONFIG,
    );
    expect(resultado.detalle_calculo.calculo.recargo_oscura).toBeCloseTo(35, 2);
  });

  it("sigue limitado a 2 colores", () => {
    expect(() =>
      calcularImpresionDirecta(
        { ...INPUT_BASE, num_colores: 3 as 1 | 2 },
        CONFIG,
      ),
    ).toThrow(/Máximo 2 colores/);
  });
});
