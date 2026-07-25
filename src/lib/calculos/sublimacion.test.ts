import { describe, expect, it } from "vitest";

import {
  calcularSublimacion,
  type SublimacionConfig,
  type SublimacionInput,
} from "./sublimacion";
import type { TramoMargen } from "./types";

// Márgenes SUBLIMACION sembrados en `tramos_margen`.
const TRAMOS_SUBLIMACION: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 55 },
  { desde: 20, hasta: 99, margen_pct: 45 },
  { desde: 100, hasta: 499, margen_pct: 35 },
  { desde: 500, hasta: null, margen_pct: 25 },
];

// Estado real de `parametros_sublimacion`: todo a cero, PTE tarifa de Espe.
const CONFIG_SEMILLA: SublimacionConfig = {
  precio_unitario_base: 0,
  cantidad_minima: 1,
  tasa_merma_pct: 0,
  solo_blanco_poliester: true,
  minimo_trabajo: 15,
  tramos_margen: TRAMOS_SUBLIMACION,
};

// Configuración hipotética para validar que la fórmula funciona el día que
// Espe dé los números reales.
const CONFIG_HIPOTETICA: SublimacionConfig = {
  ...CONFIG_SEMILLA,
  precio_unitario_base: 2.5,
  cantidad_minima: 10,
};

const INPUT_BASE: SublimacionInput = {
  cantidad: 50,
  posicion: "pecho",
  tipo_cliente: "esporadico",
};

describe("calcularSublimacion — configuración actual (PTE tarifa Espe)", () => {
  it("bloquea el presupuesto mientras el precio base sea 0", () => {
    expect(() => calcularSublimacion(INPUT_BASE, CONFIG_SEMILLA)).toThrow(
      /PTE TARIFA ESPE/,
    );
  });

  it("da un mensaje que dice qué hacer", () => {
    expect(() => calcularSublimacion(INPUT_BASE, CONFIG_SEMILLA)).toThrow(
      /panel de administración/,
    );
  });
});

describe("calcularSublimacion — cálculo con tarifa hipotética", () => {
  const resultado = calcularSublimacion(INPUT_BASE, CONFIG_HIPOTETICA);

  it("suma 125 € de subtotal: 50 × 2.50 €", () => {
    expect(resultado.detalle_calculo.calculo.subtotal_base).toBeCloseTo(125, 2);
  });

  it("no añade merma si la tasa es 0", () => {
    expect(resultado.detalle_calculo.calculo.merma).toBe(0);
  });

  it("aplica el margen del 45% (tramo 20-99): 181.25 €", () => {
    expect(resultado.margen_aplicado_pct).toBe(45);
    expect(resultado.importe_linea).toBeCloseTo(181.25, 2);
  });

  it("muestra 3.63 €/ud", () => {
    expect(resultado.precio_unitario).toBeCloseTo(3.63, 2);
  });

  it("no genera extras", () => {
    expect(resultado.extras).toEqual([]);
  });

  it("genera un snapshot con técnica SUBLIMACION serializable", () => {
    const snapshot = resultado.detalle_calculo;
    expect(snapshot.tecnica).toBe("SUBLIMACION");
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("calcularSublimacion — tasa de merma", () => {
  const resultado = calcularSublimacion(INPUT_BASE, {
    ...CONFIG_HIPOTETICA,
    tasa_merma_pct: 5,
  });

  it("incrementa el subtotal un 5%: 125 → 131.25 €", () => {
    expect(resultado.detalle_calculo.calculo.merma).toBeCloseTo(6.25, 2);
    expect(resultado.detalle_calculo.calculo.subtotal_con_merma).toBeCloseTo(
      131.25,
      2,
    );
  });

  it("encarece la línea frente al mismo pedido sin merma", () => {
    const sinMerma = calcularSublimacion(INPUT_BASE, CONFIG_HIPOTETICA);
    expect(resultado.importe_linea).toBeGreaterThan(sinMerma.importe_linea);
  });

  it("guarda la tasa aplicada en el snapshot", () => {
    expect(resultado.detalle_calculo.parametros_aplicados.tasa_merma_pct).toBe(
      5,
    );
  });
});

describe("calcularSublimacion — cantidad mínima", () => {
  it("lanza si no se alcanza la cantidad mínima", () => {
    expect(() =>
      calcularSublimacion({ ...INPUT_BASE, cantidad: 5 }, CONFIG_HIPOTETICA),
    ).toThrow(/Cantidad mínima de sublimación no alcanzada/);
  });

  it("acepta exactamente la cantidad mínima", () => {
    expect(() =>
      calcularSublimacion({ ...INPUT_BASE, cantidad: 10 }, CONFIG_HIPOTETICA),
    ).not.toThrow();
  });

  it("aplica el mínimo de trabajo con pedidos pequeños", () => {
    // 10 uds × 2.50 € = 25 €, por encima de los 15 €: no se aplica.
    const resultado = calcularSublimacion(
      { ...INPUT_BASE, cantidad: 10 },
      CONFIG_HIPOTETICA,
    );
    expect(resultado.aplicado_minimo).toBe(false);

    // Con un precio base bajo sí se aplica: 10 × 0.50 € = 5 € → 15 €.
    const barato = calcularSublimacion(
      { ...INPUT_BASE, cantidad: 10 },
      { ...CONFIG_HIPOTETICA, precio_unitario_base: 0.5 },
    );
    expect(barato.coste_interno).toBe(15);
    expect(barato.aplicado_minimo).toBe(true);
  });
});
