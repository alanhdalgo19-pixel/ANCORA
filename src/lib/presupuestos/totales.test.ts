// Tests del desglose fiscal del presupuesto (CLAUDE.md 13.6).
//
// El caso que motivó el Prompt 7 es el primero: con 100 € de líneas y 20 € de
// transporte al 21%, el transporte tiene que tributar. Antes salía 141 € (el
// transporte iba fuera del IVA); ahora salen 145,20 €.

import { describe, expect, it } from "vitest";
import { calcularTotalesPresupuesto } from "./totales";

describe("calcularTotalesPresupuesto", () => {
  it("mete el transporte en la base imponible (caso del Prompt 7)", () => {
    const totales = calcularTotalesPresupuesto({
      subtotal: 100,
      descuentoPct: 0,
      transporte: 20,
      ivaPct: 21,
    });

    expect(totales.baseImponible).toBe(120);
    expect(totales.ivaImporte).toBe(25.2);
    expect(totales.total).toBe(145.2);
  });

  it("no factura el transporte como importe exento (regresión del bug)", () => {
    const conTransporte = calcularTotalesPresupuesto({
      subtotal: 100,
      descuentoPct: 0,
      transporte: 20,
      ivaPct: 21,
    });
    const formulaAntigua = 100 + 21 + 20; // subtotal + IVA(subtotal) + transporte

    expect(conTransporte.total).not.toBe(formulaAntigua);
    // La diferencia es exactamente el IVA del transporte.
    expect(conTransporte.total - formulaAntigua).toBeCloseTo(20 * 0.21, 2);
  });

  it("sin transporte ni descuento, la base es el subtotal", () => {
    const totales = calcularTotalesPresupuesto({
      subtotal: 250,
      descuentoPct: 0,
      transporte: 0,
      ivaPct: 21,
    });

    expect(totales.baseImponible).toBe(250);
    expect(totales.ivaImporte).toBe(52.5);
    expect(totales.total).toBe(302.5);
  });

  it("aplica el descuento sobre el subtotal, no sobre el transporte", () => {
    const totales = calcularTotalesPresupuesto({
      subtotal: 200,
      descuentoPct: 10,
      transporte: 30,
      ivaPct: 21,
    });

    expect(totales.descuentoImporte).toBe(20);
    // 200 − 20 + 30 = 210, no (200 + 30) × 0.9 = 207.
    expect(totales.baseImponible).toBe(210);
    expect(totales.ivaImporte).toBe(44.1);
    expect(totales.total).toBe(254.1);
  });

  it("redondea a dos decimales en cada paso", () => {
    const totales = calcularTotalesPresupuesto({
      subtotal: 59.545,
      descuentoPct: 7.5,
      transporte: 12.333,
      ivaPct: 21,
    });

    for (const valor of Object.values(totales)) {
      expect(redondeadoADosDecimales(valor)).toBe(true);
    }
    // La base cuadra con sus sumandos redondeados, para que el desglose que ve
    // el cliente en el PDF sume céntimo a céntimo.
    expect(totales.baseImponible).toBe(
      Number(
        (
          totales.subtotal -
          totales.descuentoImporte +
          totales.transporte
        ).toFixed(2),
      ),
    );
    expect(totales.total).toBe(
      Number((totales.baseImponible + totales.ivaImporte).toFixed(2)),
    );
  });

  it("un presupuesto vacío da todo a cero", () => {
    const totales = calcularTotalesPresupuesto({
      subtotal: 0,
      descuentoPct: 0,
      transporte: 0,
      ivaPct: 21,
    });

    expect(totales).toEqual({
      subtotal: 0,
      descuentoImporte: 0,
      transporte: 0,
      baseImponible: 0,
      ivaImporte: 0,
      total: 0,
    });
  });

  it("un descuento del 100% deja solo el transporte en la base", () => {
    const totales = calcularTotalesPresupuesto({
      subtotal: 80,
      descuentoPct: 100,
      transporte: 15,
      ivaPct: 21,
    });

    expect(totales.baseImponible).toBe(15);
    expect(totales.total).toBe(18.15);
  });
});

function redondeadoADosDecimales(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-9;
}
