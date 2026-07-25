import { describe, expect, it } from "vitest";

import {
  aplicarMargen,
  aplicarMinimoTrabajo,
  buscarTramoMargen,
  calcularExtras,
  construirSnapshot,
  etiquetarTramo,
  redondear2,
  validarCantidad,
} from "./helpers";
import type { TramoMargen } from "./types";

const TRAMOS_DTF: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 60 },
  { desde: 20, hasta: 99, margen_pct: 50 },
  { desde: 100, hasta: 499, margen_pct: 40 },
  { desde: 500, hasta: null, margen_pct: 30 },
];

describe("redondear2", () => {
  it("redondea 1.234 → 1.23", () => {
    expect(redondear2(1.234)).toBe(1.23);
  });

  it("redondea 1.235 → 1.24 (half-up, no bancario)", () => {
    expect(redondear2(1.235)).toBe(1.24);
  });

  it("mantiene enteros: 5 → 5", () => {
    expect(redondear2(5)).toBe(5);
  });

  it("absorbe el ruido binario: 0.1 * 3 → 0.3", () => {
    expect(redondear2(0.1 * 3)).toBe(0.3);
  });

  it("redondea negativos hacia arriba: -1.235 → -1.23", () => {
    // Math.round redondea el .5 hacia +∞, también en negativos.
    expect(redondear2(-1.235)).toBe(-1.23);
  });

  it("lanza si el valor no es finito", () => {
    expect(() => redondear2(Number.NaN)).toThrow(/no numérico/);
  });
});

describe("aplicarMinimoTrabajo", () => {
  it("devuelve el mínimo cuando el coste es menor", () => {
    expect(aplicarMinimoTrabajo(9.5, 15).coste).toBe(15);
  });

  it("marca aplicado=true si se aplicó el mínimo", () => {
    expect(aplicarMinimoTrabajo(9.5, 15).aplicado).toBe(true);
  });

  it("devuelve el coste original cuando es mayor", () => {
    expect(aplicarMinimoTrabajo(42.53, 15)).toEqual({
      coste: 42.53,
      aplicado: false,
    });
  });

  it("no aplica el mínimo cuando el coste es exactamente igual", () => {
    expect(aplicarMinimoTrabajo(15, 15)).toEqual({ coste: 15, aplicado: false });
  });
});

describe("buscarTramoMargen", () => {
  it("encuentra el tramo correcto para una cantidad intermedia", () => {
    expect(buscarTramoMargen(TRAMOS_DTF, 120)?.margen_pct).toBe(40);
  });

  it("es inclusivo en el límite inferior", () => {
    expect(buscarTramoMargen(TRAMOS_DTF, 100)?.margen_pct).toBe(40);
  });

  it("es inclusivo en el límite superior", () => {
    expect(buscarTramoMargen(TRAMOS_DTF, 99)?.margen_pct).toBe(50);
  });

  it("encuentra el tramo con hasta=null cuando la cantidad es enorme", () => {
    expect(buscarTramoMargen(TRAMOS_DTF, 100_000)?.margen_pct).toBe(30);
  });

  it("devuelve null si no hay tramo aplicable", () => {
    const parciales: TramoMargen[] = [{ desde: 10, hasta: 20, margen_pct: 40 }];
    expect(buscarTramoMargen(parciales, 5)).toBeNull();
  });
});

describe("etiquetarTramo", () => {
  it("etiqueta un tramo cerrado como 100-499", () => {
    expect(etiquetarTramo({ desde: 100, hasta: 499, margen_pct: 40 })).toBe(
      "100-499",
    );
  });

  it("etiqueta un tramo abierto como 500+", () => {
    expect(etiquetarTramo({ desde: 500, hasta: null, margen_pct: 30 })).toBe(
      "500+",
    );
  });
});

describe("aplicarMargen", () => {
  it("aplica un margen del 40% correctamente: 100 → 140", () => {
    expect(aplicarMargen(100, TRAMOS_DTF, 120).precio).toBe(140);
  });

  it("devuelve el porcentaje del tramo aplicado", () => {
    expect(aplicarMargen(100, TRAMOS_DTF, 120).margen_pct).toBe(40);
  });

  it("etiqueta el tramo correctamente", () => {
    expect(aplicarMargen(100, TRAMOS_DTF, 120).tramo).toBe("100-499");
  });

  it("redondea el precio resultante a 2 decimales", () => {
    expect(aplicarMargen(42.53, TRAMOS_DTF, 120).precio).toBe(59.54);
  });

  it("lanza un error descriptivo si no hay tramo", () => {
    expect(() => aplicarMargen(100, [], 120)).toThrow(
      /No hay tramo de margen configurado/,
    );
  });
});

describe("calcularExtras", () => {
  it("suma los importes de los extras", () => {
    expect(
      calcularExtras([
        { descripcion: "Picaje sencillo", importe: 40 },
        { descripcion: "Vectorización", importe: 35 },
      ]),
    ).toBe(75);
  });

  it("devuelve 0 si no hay extras", () => {
    expect(calcularExtras([])).toBe(0);
  });
});

describe("construirSnapshot", () => {
  it("incluye técnica, versión y los tres bloques", () => {
    const snapshot = construirSnapshot({
      tecnica: "DTF",
      inputs: { cantidad: 120 },
      parametros_aplicados: { precio_metro: 10 },
      calculo: { coste_interno: 42.53 },
      comercial: {
        tipo_cliente: "esporadico",
        tramo_cantidad: "100-499",
        margen_pct: 40,
        precio_pre_extras: 59.54,
        extras: [],
        precio_unitario: 0.5,
      },
    });

    expect(snapshot.tecnica).toBe("DTF");
    expect(snapshot.version_calculo).toBe("1.0");
    expect(snapshot.inputs.cantidad).toBe(120);
    expect(snapshot.parametros_aplicados.precio_metro).toBe(10);
    expect(snapshot.calculo.coste_interno).toBe(42.53);
    expect(snapshot.comercial.tramo_cantidad).toBe("100-499");
  });
});

describe("validarCantidad", () => {
  it("acepta una cantidad entera positiva", () => {
    expect(() => validarCantidad(1)).not.toThrow();
  });

  it("rechaza el cero", () => {
    expect(() => validarCantidad(0)).toThrow(/mayor que cero/);
  });

  it("rechaza cantidades decimales", () => {
    expect(() => validarCantidad(2.5)).toThrow(/entero/);
  });
});
