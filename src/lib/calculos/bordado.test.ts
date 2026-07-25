import { describe, expect, it } from "vitest";

import {
  calcularBordado,
  type BordadoConfig,
  type BordadoInput,
} from "./bordado";
import type { TramoMargen } from "./types";

// Márgenes BORDADO sembrados en `tramos_margen`.
const TRAMOS_BORDADO: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 55 },
  { desde: 20, hasta: 99, margen_pct: 45 },
  { desde: 100, hasta: 499, margen_pct: 35 },
  { desde: 500, hasta: null, margen_pct: 25 },
];

// Parámetros reales de `parametros_bordado`.
const CONFIG: BordadoConfig = {
  precio_tarifa_1: 0.35,
  precio_tarifa_2: 0.4,
  precio_tarifa_3: 0.45,
  precio_personalizable_default: 0.45,
  unidad_medida: "por_1000_puntadas",
  minimo_pieza: 1.0,
  minimo_trabajo: 15.0,
  precios_picaje: {
    SENCILLO: 40,
    MEDIO: 50,
    COMPLEJO: 55,
    PERSONALIZADO: 45,
  },
  tramos_margen: TRAMOS_BORDADO,
};

const INPUT_BASE: BordadoInput = {
  cantidad: 100,
  puntadas: 5000,
  tarifa_seleccionada: "tarifa_1",
  posicion: "pecho",
  tipo_cliente: "esporadico",
};

describe("calcularBordado — Formentera Lines (302 uds, logo 8×2, 1.90 €/ud histórico)", () => {
  // Presupuesto histórico real: 302 unidades a 1.90 €/pieza.
  // Un texto de 8×2 cm ronda las 5500 puntadas.
  const resultado = calcularBordado(
    { ...INPUT_BASE, cantidad: 302, puntadas: 5500 },
    CONFIG,
  );
  const precioTarifa = resultado.detalle_calculo.calculo.precio_unitario_tarifa;

  it("reproduce el precio histórico de 1.90 €/pieza con por_1000_puntadas", () => {
    // 5500 / 1000 * 0.35 = 1.925 → 1.93 (el histórico es 1.90).
    expect(precioTarifa).toBeCloseTo(1.9, 1);
  });

  it("descarta por_100_puntadas: daría 19.25 €/pieza (10× el histórico)", () => {
    const conCien = calcularBordado(
      { ...INPUT_BASE, cantidad: 302, puntadas: 5500 },
      { ...CONFIG, unidad_medida: "por_100_puntadas" },
    );
    expect(
      conCien.detalle_calculo.calculo.precio_unitario_tarifa,
    ).toBeCloseTo(19.25, 2);
  });

  it("descarta por_puntada: daría 1925 €/pieza (1000× el histórico)", () => {
    const porPuntada = calcularBordado(
      { ...INPUT_BASE, cantidad: 302, puntadas: 5500 },
      { ...CONFIG, unidad_medida: "por_puntada" },
    );
    expect(
      porPuntada.detalle_calculo.calculo.precio_unitario_tarifa,
    ).toBeCloseTo(1925, 2);
  });

  it("no aplica ningún mínimo con este volumen", () => {
    expect(resultado.aplicado_minimo).toBe(false);
  });

  it("aplica el margen del 35% (tramo 100-499)", () => {
    expect(resultado.margen_aplicado_pct).toBe(35);
  });
});

describe("calcularBordado — Colla Castellers (100 uds, 3.95 €/ud histórico)", () => {
  // Presupuesto histórico real: 100 unidades a 3.95 €/pieza sobre tela gris.
  // Un escudo bordado de ese tamaño ronda las 11000 puntadas.
  const resultado = calcularBordado(
    { ...INPUT_BASE, cantidad: 100, puntadas: 11000, tipo_cliente: "habitual" },
    CONFIG,
  );
  const precioTarifa = resultado.detalle_calculo.calculo.precio_unitario_tarifa;

  it("queda en el orden de magnitud del histórico (3.85 € vs 3.95 €)", () => {
    // No busca cuadrar al céntimo: Espe pudo ajustar el precio a mano.
    expect(precioTarifa).toBeGreaterThan(3.5);
    expect(precioTarifa).toBeLessThan(4.3);
  });

  it("calcula 11 * 0.35 = 3.85 €/pieza", () => {
    expect(precioTarifa).toBeCloseTo(3.85, 2);
  });

  it("factura 385 € de bordado antes del margen", () => {
    expect(resultado.coste_interno).toBeCloseTo(385, 2);
  });
});

describe("calcularBordado — mínimo por pieza", () => {
  const resultado = calcularBordado({ ...INPUT_BASE, puntadas: 500 }, CONFIG);

  it("calcula 0.18 €/pieza por tarifa (500 puntadas)", () => {
    expect(
      resultado.detalle_calculo.calculo.precio_unitario_tarifa,
    ).toBeCloseTo(0.18, 2);
  });

  it("eleva el precio por pieza hasta el mínimo de 1 €", () => {
    expect(resultado.detalle_calculo.calculo.precio_unitario_pieza).toBe(1);
    expect(resultado.detalle_calculo.calculo.aplicado_minimo_pieza).toBe(true);
  });

  it("marca aplicado_minimo en el resultado", () => {
    expect(resultado.aplicado_minimo).toBe(true);
  });
});

describe("calcularBordado — mínimo de trabajo", () => {
  // 5 piezas de 3000 puntadas = 5 * 1.05 = 5.25 €, por debajo de los 15 €.
  const resultado = calcularBordado(
    { ...INPUT_BASE, cantidad: 5, puntadas: 3000 },
    CONFIG,
  );

  it("eleva el subtotal hasta los 15 € del mínimo de trabajo", () => {
    expect(resultado.detalle_calculo.calculo.subtotal_bordado).toBeCloseTo(
      5.25,
      2,
    );
    expect(resultado.coste_interno).toBe(15);
    expect(resultado.detalle_calculo.calculo.aplicado_minimo_trabajo).toBe(
      true,
    );
  });
});

describe("calcularBordado — cliente habitual con descuento del 15%", () => {
  // 3000 puntadas → 1.05 €/pieza. Con -15% → 0.8925 €, POR DEBAJO del mínimo
  // de 1 €. Si el descuento se aplicase después del mínimo el resultado sería
  // 0.89 €; este test fija el orden correcto (PASO 3 antes que PASO 4).
  const habitual = calcularBordado(
    {
      ...INPUT_BASE,
      puntadas: 3000,
      tipo_cliente: "habitual",
      descuento_habitual_pct: 15,
    },
    CONFIG,
  );

  it("aplica el descuento sobre el precio de tarifa", () => {
    expect(
      habitual.detalle_calculo.calculo.precio_unitario_con_descuento,
    ).toBeCloseTo(0.89, 2);
  });

  it("aplica el descuento ANTES del mínimo, no después", () => {
    expect(habitual.detalle_calculo.calculo.precio_unitario_pieza).toBe(1);
    expect(habitual.detalle_calculo.calculo.aplicado_minimo_pieza).toBe(true);
  });

  it("ignora el descuento si el cliente es esporádico", () => {
    const esporadico = calcularBordado(
      { ...INPUT_BASE, puntadas: 3000, descuento_habitual_pct: 15 },
      CONFIG,
    );
    expect(esporadico.detalle_calculo.calculo.descuento_habitual_pct).toBe(0);
    expect(
      esporadico.detalle_calculo.calculo.precio_unitario_con_descuento,
    ).toBeCloseTo(1.05, 2);
  });

  it("abarata la línea frente al mismo pedido sin descuento", () => {
    const conDescuento = calcularBordado(
      {
        ...INPUT_BASE,
        puntadas: 8000,
        tipo_cliente: "habitual",
        descuento_habitual_pct: 15,
      },
      CONFIG,
    );
    const sinDescuento = calcularBordado(
      { ...INPUT_BASE, puntadas: 8000 },
      CONFIG,
    );
    expect(conDescuento.importe_linea).toBeLessThan(sinDescuento.importe_linea);
  });
});

describe("calcularBordado — picaje como extra", () => {
  it("añade el picaje complejo con su precio de catálogo", () => {
    const resultado = calcularBordado(
      { ...INPUT_BASE, trabajo_nuevo: true, tipo_picaje: "COMPLEJO" },
      CONFIG,
    );
    expect(resultado.extras).toEqual([
      { descripcion: "Picaje complejo", importe: 55 },
    ]);
  });

  it("NO suma el picaje al importe de línea (va en línea aparte)", () => {
    const conPicaje = calcularBordado(
      { ...INPUT_BASE, trabajo_nuevo: true, tipo_picaje: "SENCILLO" },
      CONFIG,
    );
    const sinPicaje = calcularBordado(INPUT_BASE, CONFIG);
    expect(conPicaje.importe_linea).toBe(sinPicaje.importe_linea);
  });

  it("permite sobreescribir el precio del picaje PERSONALIZADO", () => {
    const resultado = calcularBordado(
      {
        ...INPUT_BASE,
        trabajo_nuevo: true,
        tipo_picaje: "PERSONALIZADO",
        precio_picaje_personalizado: 62.5,
      },
      CONFIG,
    );
    expect(resultado.extras[0]).toEqual({
      descripcion: "Picaje personalizado",
      importe: 62.5,
    });
  });

  it("lanza si el trabajo es nuevo pero no se eligió tipo de picaje", () => {
    expect(() =>
      calcularBordado({ ...INPUT_BASE, trabajo_nuevo: true }, CONFIG),
    ).toThrow(/tipo de picaje/);
  });
});

describe("calcularBordado — unidad por_puntada (caso límite)", () => {
  // Con la unidad mal configurada el resultado es económicamente absurdo,
  // pero el motor debe calcularlo sin romperse: elegir la unidad es
  // responsabilidad de Espe en el panel de administración.
  const resultado = calcularBordado(
    { ...INPUT_BASE, puntadas: 5000 },
    { ...CONFIG, unidad_medida: "por_puntada" },
  );

  it("calcula 1750 €/pieza: 5000 * 0.35", () => {
    expect(
      resultado.detalle_calculo.calculo.precio_unitario_tarifa,
    ).toBeCloseTo(1750, 2);
  });

  it("registra la unidad usada en el snapshot para poder auditarlo", () => {
    expect(resultado.detalle_calculo.parametros_aplicados.unidad_medida).toBe(
      "por_puntada",
    );
  });
});

describe("calcularBordado — tarifas y validaciones", () => {
  it("usa la tarifa 3 cuando se selecciona", () => {
    const resultado = calcularBordado(
      { ...INPUT_BASE, tarifa_seleccionada: "tarifa_3" },
      CONFIG,
    );
    expect(resultado.detalle_calculo.calculo.precio_tarifa_aplicada).toBe(0.45);
  });

  it("usa el precio personalizado cuando se indica", () => {
    const resultado = calcularBordado(
      {
        ...INPUT_BASE,
        tarifa_seleccionada: "personalizada",
        precio_personalizado: 0.6,
      },
      CONFIG,
    );
    expect(resultado.detalle_calculo.calculo.precio_tarifa_aplicada).toBe(0.6);
  });

  it("cae al default personalizable si no se indica precio", () => {
    const resultado = calcularBordado(
      { ...INPUT_BASE, tarifa_seleccionada: "personalizada" },
      CONFIG,
    );
    expect(resultado.detalle_calculo.calculo.precio_tarifa_aplicada).toBe(0.45);
  });

  it("lanza si las puntadas son cero", () => {
    expect(() => calcularBordado({ ...INPUT_BASE, puntadas: 0 }, CONFIG)).toThrow(
      /puntadas/,
    );
  });

  it("genera un snapshot con técnica BORDADO serializable a JSON", () => {
    const snapshot = calcularBordado(INPUT_BASE, CONFIG).detalle_calculo;
    expect(snapshot.tecnica).toBe("BORDADO");
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
