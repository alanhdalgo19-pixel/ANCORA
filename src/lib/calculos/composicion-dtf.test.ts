import { describe, expect, it } from "vitest";

import { componerDTF } from "./composicion-dtf";
import { calcularDTF, type DtfConfig } from "./dtf";
import type {
  DtfComposicionConfig,
  LogoColocado,
  LogoInput,
  TramoMargen,
} from "./types";

// Márgenes DTF sembrados en `tramos_margen` (scripts/seed_admin_data.mjs).
const TRAMOS_DTF: TramoMargen[] = [
  { desde: 1, hasta: 19, margen_pct: 60 },
  { desde: 20, hasta: 99, margen_pct: 50 },
  { desde: 100, hasta: 499, margen_pct: 40 },
  { desde: 500, hasta: null, margen_pct: 30 },
];

// Parámetros reales de `parametros_dtf` (confirmados por Espe).
const CONFIG: DtfComposicionConfig = {
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

/** Ancho realmente utilizable del rollo: 35 - 2 * 0.5 = 34 cm. */
const ANCHO_UTIL = CONFIG.ancho_rollo_cm - 2 * CONFIG.margen_seguridad_cm;

// ---------------------------------------------------------------------------
// Helpers de los tests de propiedad
// ---------------------------------------------------------------------------

/** ¿Se solapan dos logos colocados? Bordes que se tocan NO cuentan. */
function intersecta(a: LogoColocado, b: LogoColocado): boolean {
  const separadosEnX =
    a.x_cm + a.ancho_cm <= b.x_cm || b.x_cm + b.ancho_cm <= a.x_cm;
  const separadosEnY =
    a.y_cm + a.alto_cm <= b.y_cm || b.y_cm + b.alto_cm <= a.y_cm;
  return !separadosEnX && !separadosEnY;
}

/** Devuelve el primer par de logos solapados, o `null` si no hay ninguno. */
function primerSolape(
  layout: LogoColocado[],
): [LogoColocado, LogoColocado] | null {
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      if (intersecta(layout[i], layout[j])) return [layout[i], layout[j]];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// G.1 — Casos básicos
// ---------------------------------------------------------------------------

describe("Test 1 — un solo tipo de logo (100 uds de 9×4, no rotable)", () => {
  const logos: LogoInput[] = [
    { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: 100, rotable: false },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("coloca las 100 unidades en el layout", () => {
    expect(resultado.layout).toHaveLength(100);
    expect(resultado.cantidad_total_logos).toBe(100);
  });

  it("no rota ninguna unidad", () => {
    expect(resultado.layout.every((logo) => !logo.rotado)).toBe(true);
  });

  it("mete 3 logos por fila, igual que el cálculo simple", () => {
    // 34 estanterías = ceil(100 / 3), el mismo reparto que `calcularDTF`.
    expect(resultado.detalle_calculo.composicion.num_estanterias).toBe(34);
  });

  it("consume los mismos metros que `calcularDTF` (± el margen del borde)", () => {
    const configSimple: DtfConfig = { ...CONFIG };
    const simple = calcularDTF(
      {
        cantidad: 100,
        ancho_logo_cm: 9,
        alto_logo_cm: 4,
        posicion: "pecho",
        tipo_cliente: "esporadico",
      },
      configSimple,
    );

    // 1.54 m (composición) vs 1.53 m (simple): la composición añade el margen
    // de seguridad del borde superior del rollo, que el cálculo simple ignora.
    expect(resultado.metros_necesarios).toBeCloseTo(1.54, 2);
    expect(simple.detalle_calculo.calculo.metros_necesarios).toBeCloseTo(
      1.53,
      2,
    );
    expect(
      resultado.metros_necesarios -
        simple.detalle_calculo.calculo.metros_necesarios,
    ).toBeCloseTo(0.01, 2);
  });

  it("calcula la eficiencia sobre el área realmente ocupada", () => {
    // 100 * 36 cm² / (35 cm * 153.5 cm) = 67.0 %
    expect(resultado.detalle_calculo.composicion.altura_consumida_cm).toBeCloseTo(
      153.5,
      2,
    );
    expect(resultado.eficiencia_pct).toBeCloseTo(67.0, 1);
  });
});

describe("Test 2 — dos tamaños distintos (caso Doyle)", () => {
  const logos: LogoInput[] = [
    {
      id: "L1",
      nombre: "Doyle pecho",
      ancho_cm: 9,
      alto_cm: 4,
      cantidad: 100,
      rotable: false,
    },
    {
      id: "L2",
      nombre: "Doyle espalda",
      ancho_cm: 25,
      alto_cm: 30,
      cantidad: 20,
      rotable: false,
    },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("suma 120 logos en total", () => {
    expect(resultado.cantidad_total_logos).toBe(120);
    expect(resultado.layout).toHaveLength(120);
  });

  it("coloca primero los logos grandes (First-Fit Decreasing)", () => {
    // Los 20 de espalda (alto 30) van antes que los 100 de pecho (alto 4).
    const primeros20 = resultado.layout.slice(0, 20);
    expect(primeros20.every((logo) => logo.logo_id === "L2")).toBe(true);
    expect(resultado.layout[20].logo_id).toBe("L1");
  });

  it("no solapa ningún logo", () => {
    expect(primerSolape(resultado.layout)).toBeNull();
  });

  it("consume 7.64 m de rollo", () => {
    // NOTA: el enunciado del Prompt 5 esperaba "< 3 metros" para este caso,
    // pero es físicamente imposible. Un logo de 25 cm de ancho solo entra UNO
    // por fila en un rollo de 35 cm, así que los 20 de espalda ya consumen
    // 20 * (30 + 0.5) = 610 cm = 6.10 m por sí solos. Ni siquiera el óptimo
    // teórico bajaría de 5.31 m (18 600 cm² de logos / 35 cm de ancho).
    expect(resultado.metros_necesarios).toBeCloseTo(7.64, 2);
  });

  it("aprovecha más del 60 % del rollo", () => {
    // 18 600 cm² de logos / (35 * 763.5) cm² de rollo = 69.6 %
    expect(resultado.eficiencia_pct).toBeGreaterThan(60);
    expect(resultado.eficiencia_pct).toBeCloseTo(69.6, 1);
  });

  it("avisa de que el logo de espalda ahorraría rollo rotado", () => {
    // 25×30 no rotable: tumbado (30 de ancho, 25 de alto) cabría en 34 cm y
    // ahorraría 5 cm por fila × 20 filas = 1 metro de rollo.
    expect(
      resultado.warnings.some((aviso) => aviso.includes("Doyle espalda")),
    ).toBe(true);
  });
});

describe("Test 3 — tres tamaños con rotación mixta", () => {
  const logos: LogoInput[] = [
    { id: "R1", ancho_cm: 5, alto_cm: 20, cantidad: 5, rotable: true },
    { id: "F1", ancho_cm: 15, alto_cm: 10, cantidad: 10, rotable: false },
    { id: "R2", ancho_cm: 3, alto_cm: 3, cantidad: 30, rotable: true },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("tumba los 5×20 rotables y los coloca como 20×5", () => {
    const rotados = resultado.layout.filter((logo) => logo.logo_id === "R1");
    expect(rotados).toHaveLength(5);
    expect(rotados.every((logo) => logo.rotado)).toBe(true);
    expect(rotados.every((logo) => logo.ancho_cm === 20)).toBe(true);
    expect(rotados.every((logo) => logo.alto_cm === 5)).toBe(true);
  });

  it("no rota los 15×10 marcados como no rotables", () => {
    const fijos = resultado.layout.filter((logo) => logo.logo_id === "F1");
    expect(fijos).toHaveLength(10);
    expect(fijos.every((logo) => !logo.rotado)).toBe(true);
    expect(fijos.every((logo) => logo.ancho_cm === 15)).toBe(true);
  });

  it("deja los cuadrados 3×3 sin rotar aunque sean rotables", () => {
    // Rotar un cuadrado no cambia nada: se deja sin rotar por estabilidad.
    const cuadrados = resultado.layout.filter((logo) => logo.logo_id === "R2");
    expect(cuadrados).toHaveLength(30);
    expect(cuadrados.every((logo) => !logo.rotado)).toBe(true);
  });

  it("compone las 45 unidades sin solapes", () => {
    expect(resultado.cantidad_total_logos).toBe(45);
    expect(primerSolape(resultado.layout)).toBeNull();
  });

  it("consume 0.84 m de rollo en 11 estanterías", () => {
    expect(resultado.metros_necesarios).toBeCloseTo(0.84, 2);
    expect(resultado.detalle_calculo.composicion.num_estanterias).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// G.2 — Casos de error
// ---------------------------------------------------------------------------

describe("Test 4 — logo demasiado ancho y no rotable", () => {
  it("lanza indicando el ancho útil real del rollo", () => {
    const logos: LogoInput[] = [
      {
        id: "X1",
        nombre: "Cartel gigante",
        ancho_cm: 40,
        alto_cm: 20,
        cantidad: 5,
        rotable: false,
      },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(
      /El logo 'Cartel gigante' es demasiado ancho para el rollo \(40 cm > 34 cm\)/,
    );
  });

  it("usa el id cuando el logo no tiene nombre", () => {
    const logos: LogoInput[] = [
      { id: "X1", ancho_cm: 40, alto_cm: 20, cantidad: 5, rotable: false },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(/El logo 'X1'/);
  });

  it("lanza también si es rotable pero NINGUNA orientación cabe", () => {
    const logos: LogoInput[] = [
      { id: "X2", ancho_cm: 40, alto_cm: 36, cantidad: 1, rotable: true },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(
      /es demasiado ancho para el rollo/,
    );
  });
});

describe("Test 5 — logo demasiado ancho pero rotable con lado menor válido", () => {
  const logos: LogoInput[] = [
    { id: "R1", ancho_cm: 40, alto_cm: 20, cantidad: 2, rotable: true },
  ];

  it("no lanza: lo coloca rotado como 20×40", () => {
    const resultado = componerDTF(logos, CONFIG);
    expect(resultado.layout).toHaveLength(2);
    expect(resultado.layout.every((logo) => logo.rotado)).toBe(true);
    expect(resultado.layout[0].ancho_cm).toBe(20);
    expect(resultado.layout[0].alto_cm).toBe(40);
  });

  it("respeta el ancho del rollo con la orientación forzada", () => {
    const resultado = componerDTF(logos, CONFIG);
    for (const logo of resultado.layout) {
      expect(logo.x_cm + logo.ancho_cm).toBeLessThanOrEqual(
        CONFIG.ancho_rollo_cm,
      );
    }
  });
});

describe("Test 6 — sin logos", () => {
  it("lanza 'No hay logos que componer'", () => {
    expect(() => componerDTF([], CONFIG)).toThrow(/No hay logos que componer/);
  });
});

describe("Test 7 — cantidad inválida", () => {
  it("lanza con cantidad 0", () => {
    const logos: LogoInput[] = [
      {
        id: "L1",
        nombre: "Pecho",
        ancho_cm: 9,
        alto_cm: 4,
        cantidad: 0,
        rotable: false,
      },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(
      /Cantidad inválida para el logo 'Pecho'/,
    );
  });

  it("lanza con cantidad negativa", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: -3, rotable: false },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(/Cantidad inválida/);
  });

  it("lanza con cantidad decimal", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: 2.5, rotable: false },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(/Cantidad inválida/);
  });

  it("lanza si alguna medida es cero o negativa", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 0, alto_cm: 4, cantidad: 10, rotable: false },
    ];
    expect(() => componerDTF(logos, CONFIG)).toThrow(
      /Las medidas del logo 'L1' deben ser mayores que cero/,
    );
  });
});

// ---------------------------------------------------------------------------
// G.3 — Casos reales de Ancora
// ---------------------------------------------------------------------------

describe("Test 8 — plantilla típica de Josefa (100 + 20 + 3)", () => {
  const logos: LogoInput[] = [
    {
      id: "P",
      nombre: "Pecho",
      ancho_cm: 8,
      alto_cm: 4,
      cantidad: 100,
      rotable: false,
    },
    {
      id: "E",
      nombre: "Espalda",
      ancho_cm: 20,
      alto_cm: 25,
      cantidad: 20,
      rotable: false,
    },
    {
      id: "T",
      nombre: "Etiqueta",
      ancho_cm: 5,
      alto_cm: 3,
      cantidad: 3,
      rotable: false,
    },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("compone las 123 unidades sin solapes", () => {
    expect(resultado.cantidad_total_logos).toBe(123);
    expect(resultado.layout).toHaveLength(123);
    expect(primerSolape(resultado.layout)).toBeNull();
  });

  it("rellena el hueco lateral de las filas grandes con logos pequeños", () => {
    // Cada fila de un logo de espalda (20 cm) deja 14 cm libres: ahí caben un
    // logo de pecho (8 cm) y una etiqueta (5 cm). Eso es exactamente lo que
    // hace Josefa a mano en Corel.
    const filasGrandes = resultado.layout.filter(
      (logo) => logo.logo_id === "E",
    );
    const yFilasGrandes = new Set(filasGrandes.map((logo) => logo.y_cm));
    const acompañantes = resultado.layout.filter(
      (logo) => logo.logo_id !== "E" && yFilasGrandes.has(logo.y_cm),
    );
    expect(acompañantes.length).toBeGreaterThan(20);
  });

  it("consume 6.01 m en 40 estanterías con 63.0 % de eficiencia", () => {
    expect(resultado.metros_necesarios).toBeCloseTo(6.01, 2);
    expect(resultado.detalle_calculo.composicion.num_estanterias).toBe(40);
    expect(resultado.eficiencia_pct).toBeCloseTo(63.0, 1);
  });

  it("desglosa el coste hasta 93.41 € de coste interno", () => {
    expect(resultado.coste_material).toBeCloseTo(60.1, 2);
    expect(resultado.coste_recorte).toBeCloseTo(12.3, 2);
    expect(resultado.minutos_estimados).toBe(17);
    expect(resultado.coste_mano_obra).toBeCloseTo(5.44, 2);
    expect(resultado.coste_interno).toBeCloseTo(93.41, 2);
    expect(resultado.aplicado_minimo).toBe(false);
  });

  it("aplica el margen del tramo 100-499 y factura 130.77 €", () => {
    expect(resultado.margen_aplicado_pct).toBe(40);
    expect(resultado.detalle_calculo.comercial.tramo_cantidad).toBe("100-499");
    expect(resultado.precio_total).toBeCloseTo(130.77, 2);
  });

  it("da un precio medio por logo comercialmente plausible", () => {
    // El enunciado esperaba 0.30–1.00 €, pero ese rango sale de presupuestos
    // de logos de pecho sueltos. Aquí 20 de las 123 unidades son estampaciones
    // de espalda de 20×25 (500 cm² cada una, 15 veces el área de un pecho),
    // que arrastran la media hacia arriba. 1.06 € es el promedio real de una
    // plantilla mixta como esta.
    expect(resultado.precio_promedio_por_logo).toBeCloseTo(1.06, 2);
    expect(resultado.precio_promedio_por_logo).toBeGreaterThan(0.3);
    expect(resultado.precio_promedio_por_logo).toBeLessThan(1.5);
  });
});

describe("Test 9 — trabajo pequeño que cae por debajo del mínimo", () => {
  const logos: LogoInput[] = [
    { id: "L1", ancho_cm: 3, alto_cm: 3, cantidad: 5, rotable: false },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("eleva el coste interno hasta el mínimo de trabajo de 15 €", () => {
    // Coste real: 0.40 material + 0.50 recorte + 1.92 mano de obra + 20 % = 3.38 €
    expect(resultado.aplicado_minimo).toBe(true);
    expect(resultado.coste_interno).toBeCloseTo(15.0, 2);
    expect(resultado.detalle_calculo.calculo.aplicado_minimo).toBe(true);
  });

  it("aplica el margen sobre el mínimo, no sobre el coste real", () => {
    expect(resultado.margen_aplicado_pct).toBe(60);
    expect(resultado.precio_total).toBeCloseTo(24.0, 2);
    expect(resultado.precio_promedio_por_logo).toBeCloseTo(4.8, 2);
  });

  it("cabe todo en una sola estantería", () => {
    expect(resultado.detalle_calculo.composicion.num_estanterias).toBe(1);
  });
});

describe("Test 10 — cantidad grande (tramo 500+)", () => {
  const logos: LogoInput[] = [
    { id: "L1", ancho_cm: 4, alto_cm: 4, cantidad: 500, rotable: false },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("busca el margen por la cantidad TOTAL de logos", () => {
    expect(resultado.margen_aplicado_pct).toBe(30);
    expect(resultado.detalle_calculo.comercial.tramo_cantidad).toBe("500+");
  });

  it("mete 7 logos por fila en 72 estanterías", () => {
    expect(resultado.detalle_calculo.composicion.num_estanterias).toBe(72);
    expect(resultado.metros_necesarios).toBeCloseTo(3.25, 2);
  });

  it("factura 156.16 € (0.31 €/logo)", () => {
    expect(resultado.coste_interno).toBeCloseTo(120.12, 2);
    expect(resultado.precio_total).toBeCloseTo(156.16, 2);
    expect(resultado.precio_promedio_por_logo).toBeCloseTo(0.31, 2);
  });
});

// ---------------------------------------------------------------------------
// G.4 — Tests de propiedad (invariantes)
// ---------------------------------------------------------------------------

// Caso complejo compartido por los invariantes: 5 tamaños, rotables y no.
const LOGOS_COMPLEJOS: LogoInput[] = [
  { id: "A", nombre: "Espalda", ancho_cm: 22, alto_cm: 28, cantidad: 12, rotable: false },
  { id: "B", nombre: "Pecho", ancho_cm: 9, alto_cm: 5, cantidad: 60, rotable: false },
  { id: "C", nombre: "Manga larga", ancho_cm: 4, alto_cm: 18, cantidad: 24, rotable: true },
  { id: "D", nombre: "Etiqueta", ancho_cm: 6, alto_cm: 2.5, cantidad: 40, rotable: true },
  { id: "E", nombre: "Gorra", ancho_cm: 11, alto_cm: 6, cantidad: 15, rotable: false },
];

describe("Test 11 — ningún logo se solapa", () => {
  it("resuelve un caso complejo de 5 tamaños sin intersecciones", () => {
    const resultado = componerDTF(LOGOS_COMPLEJOS, CONFIG);
    expect(primerSolape(resultado.layout)).toBeNull();
  });

  it("el helper `intersecta` detecta solapes de verdad (control)", () => {
    const base: LogoColocado = {
      logo_id: "A",
      x_cm: 0,
      y_cm: 0,
      ancho_cm: 10,
      alto_cm: 10,
      rotado: false,
    };
    const encima: LogoColocado = { ...base, logo_id: "B", x_cm: 5, y_cm: 5 };
    const pegado: LogoColocado = { ...base, logo_id: "C", x_cm: 10, y_cm: 0 };

    expect(intersecta(base, encima)).toBe(true);
    expect(intersecta(base, pegado)).toBe(false);
  });
});

describe("Test 12 — todos los logos caben dentro del rollo", () => {
  const resultado = componerDTF(LOGOS_COMPLEJOS, CONFIG);
  const alturaTotal = resultado.detalle_calculo.composicion.altura_consumida_cm;

  it("ninguno se sale por el lado derecho", () => {
    for (const logo of resultado.layout) {
      expect(logo.x_cm).toBeGreaterThanOrEqual(CONFIG.margen_seguridad_cm);
      expect(logo.x_cm + logo.ancho_cm).toBeLessThanOrEqual(
        CONFIG.ancho_rollo_cm,
      );
    }
  });

  it("ninguno se sale por el final del rollo", () => {
    for (const logo of resultado.layout) {
      expect(logo.y_cm).toBeGreaterThanOrEqual(CONFIG.margen_seguridad_cm);
      expect(logo.y_cm + logo.alto_cm).toBeLessThanOrEqual(alturaTotal);
    }
  });

  it("ningún ancho aplicado supera el ancho útil", () => {
    for (const logo of resultado.layout) {
      expect(logo.ancho_cm).toBeLessThanOrEqual(ANCHO_UTIL);
    }
  });
});

describe("Test 13 — determinismo", () => {
  it("dos ejecuciones con el mismo input dan resultados idénticos", () => {
    const primera = componerDTF(LOGOS_COMPLEJOS, CONFIG);
    const segunda = componerDTF(LOGOS_COMPLEJOS, CONFIG);

    expect(segunda.metros_necesarios).toBe(primera.metros_necesarios);
    expect(segunda.eficiencia_pct).toBe(primera.eficiencia_pct);
    expect(segunda.precio_total).toBe(primera.precio_total);
    expect(segunda.layout).toEqual(primera.layout);
    expect(segunda.detalle_calculo).toEqual(primera.detalle_calculo);
  });

  it("no muta el array de logos que recibe", () => {
    const logos: LogoInput[] = LOGOS_COMPLEJOS.map((logo) => ({ ...logo }));
    const copia = JSON.stringify(logos);
    componerDTF(logos, CONFIG);
    expect(JSON.stringify(logos)).toBe(copia);
  });

  it("el snapshot conserva los inputs aunque el llamante mute su array", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: 10, rotable: false },
    ];
    const resultado = componerDTF(logos, CONFIG);
    logos[0].cantidad = 999;
    expect(resultado.detalle_calculo.inputs.logos[0].cantidad).toBe(10);
  });
});

describe("Test 14 — el layout coincide con la cantidad total", () => {
  it("hay exactamente una entrada por unidad estampada", () => {
    const resultado = componerDTF(LOGOS_COMPLEJOS, CONFIG);
    const esperado = LOGOS_COMPLEJOS.reduce(
      (suma, logo) => suma + logo.cantidad,
      0,
    );

    expect(resultado.cantidad_total_logos).toBe(esperado);
    expect(resultado.layout).toHaveLength(esperado);
    expect(resultado.detalle_calculo.layout).toHaveLength(esperado);
    expect(resultado.detalle_calculo.inputs.cantidad_total).toBe(esperado);
  });

  it("cada tipo de logo aparece tantas veces como su cantidad", () => {
    const resultado = componerDTF(LOGOS_COMPLEJOS, CONFIG);
    for (const logo of LOGOS_COMPLEJOS) {
      const colocados = resultado.layout.filter(
        (colocado) => colocado.logo_id === logo.id,
      );
      expect(colocados).toHaveLength(logo.cantidad);
    }
  });
});

// ---------------------------------------------------------------------------
// G.5 — Eficiencia del empaquetado
// ---------------------------------------------------------------------------

describe("Test 15 — logos uniformes que encajan en filas completas", () => {
  // 11 cm de ancho → 3 por fila ocupando 0.5 + 11 + 0.5 + 11 + 0.5 + 11 + 0.5
  // = 35 cm exactos. 99 unidades = 33 filas completas, sin fila a medias.
  const logos: LogoInput[] = [
    { id: "U", ancho_cm: 11, alto_cm: 11, cantidad: 99, rotable: false },
  ];
  const resultado = componerDTF(logos, CONFIG);

  it("aprovecha más del 85 % del rollo", () => {
    expect(resultado.eficiencia_pct).toBeGreaterThan(85);
    expect(resultado.eficiencia_pct).toBeCloseTo(90.1, 1);
  });

  it("llena 33 filas de 3 logos sin dejar ninguna a medias", () => {
    expect(resultado.detalle_calculo.composicion.num_estanterias).toBe(33);
    const porFila = new Map<number, number>();
    for (const logo of resultado.layout) {
      porFila.set(logo.y_cm, (porFila.get(logo.y_cm) ?? 0) + 1);
    }
    expect([...porFila.values()].every((n) => n === 3)).toBe(true);
  });

  it("no genera avisos de bajo aprovechamiento", () => {
    expect(resultado.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Snapshot y avisos
// ---------------------------------------------------------------------------

describe("snapshot `detalle_calculo`", () => {
  const logos: LogoInput[] = [
    { id: "L1", nombre: "Pecho", ancho_cm: 9, alto_cm: 4, cantidad: 100, rotable: false },
    { id: "L2", nombre: "Espalda", ancho_cm: 25, alto_cm: 30, cantidad: 20, rotable: false },
  ];
  const snapshot = componerDTF(logos, CONFIG).detalle_calculo;

  it("se identifica como DTF_COMPOSICION con la versión del motor", () => {
    expect(snapshot.tecnica).toBe("DTF_COMPOSICION");
    expect(snapshot.version_calculo).toBe("1.0");
  });

  it("registra el algoritmo usado", () => {
    expect(snapshot.composicion.algoritmo).toBe("shelf_ffd");
  });

  it("congela los parámetros aplicados", () => {
    expect(snapshot.parametros_aplicados).toEqual({
      ancho_rollo_cm: 35,
      precio_metro: 10,
      recorte_por_logo: 0.1,
      mano_obra_por_minuto: 0.32,
      preparacion_pct: 20,
      minimo_trabajo: 15,
      margen_seguridad_cm: 0.5,
      minutos_setup_fijo: 5,
      minutos_por_logo: 0.1,
    });
  });

  it("cuadra el desglose del coste céntimo a céntimo", () => {
    const { calculo } = snapshot;
    expect(
      calculo.material + calculo.recorte + calculo.mano_obra,
    ).toBeCloseTo(calculo.subtotal_sin_preparacion, 2);
    expect(
      calculo.subtotal_sin_preparacion + calculo.preparacion,
    ).toBeCloseTo(calculo.coste_interno, 2);
  });

  it("es serializable a JSON (va a una columna jsonb)", () => {
    const ida = JSON.stringify(snapshot);
    expect(JSON.parse(ida)).toEqual(snapshot);
  });
});

describe("avisos no bloqueantes", () => {
  it("avisa cuando el aprovechamiento del rollo es bajo", () => {
    // Un logo de 18×2 deja media fila libre y muy poca área ocupada.
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 18, alto_cm: 2, cantidad: 10, rotable: false },
    ];
    const resultado = componerDTF(logos, CONFIG);
    expect(resultado.eficiencia_pct).toBeLessThan(60);
    expect(
      resultado.warnings.some((aviso) =>
        aviso.includes("aprovechamiento del rollo es bajo"),
      ),
    ).toBe(true);
  });

  it("no sugiere rotar un logo que ya está marcado como rotable", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 5, alto_cm: 20, cantidad: 20, rotable: true },
    ];
    const resultado = componerDTF(logos, CONFIG);
    expect(
      resultado.warnings.some((aviso) =>
        aviso.includes("ahorraría rollo si se pudiera rotar"),
      ),
    ).toBe(false);
  });

  it("sí sugiere rotar el mismo logo cuando NO es rotable", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 5, alto_cm: 20, cantidad: 20, rotable: false },
    ];
    const resultado = componerDTF(logos, CONFIG);
    expect(
      resultado.warnings.some((aviso) =>
        aviso.includes("ahorraría rollo si se pudiera rotar"),
      ),
    ).toBe(true);
  });

  it("avisa cuando la última fila queda muy vacía", () => {
    // 100 logos de 9×4 → 33 filas de 3 + una última fila con 1 solo logo.
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: 100, rotable: false },
    ];
    const resultado = componerDTF(logos, CONFIG);
    expect(
      resultado.warnings.some((aviso) => aviso.includes("última fila")),
    ).toBe(true);
  });

  it("los avisos no alteran el precio", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 18, alto_cm: 2, cantidad: 10, rotable: false },
    ];
    const resultado = componerDTF(logos, CONFIG);
    expect(resultado.warnings.length).toBeGreaterThan(0);
    expect(resultado.precio_total).toBeGreaterThan(0);
    expect(resultado.precio_total).toBe(
      resultado.detalle_calculo.comercial.precio_total,
    );
  });
});

describe("errores de configuración", () => {
  it("lanza si no hay tramo de margen para la cantidad total", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: 50, rotable: false },
    ];
    const configSinTramo: DtfComposicionConfig = {
      ...CONFIG,
      tramos_margen: [{ desde: 1, hasta: 19, margen_pct: 60 }],
    };
    expect(() => componerDTF(logos, configSinTramo)).toThrow(
      /No hay tramo de margen configurado/,
    );
  });

  it("lanza si el margen de seguridad se come el ancho del rollo", () => {
    const logos: LogoInput[] = [
      { id: "L1", ancho_cm: 9, alto_cm: 4, cantidad: 10, rotable: false },
    ];
    const configAbsurda: DtfComposicionConfig = {
      ...CONFIG,
      ancho_rollo_cm: 1,
      margen_seguridad_cm: 0.5,
    };
    expect(() => componerDTF(logos, configAbsurda)).toThrow(
      /no deja ancho utilizable/,
    );
  });
});
