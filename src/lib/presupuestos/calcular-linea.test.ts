// Tests del puente Supabase ↔ motor de cálculo, centrados en la decisión que
// introduce el Prompt 8: una línea de DTF con un solo logo baja a `calcularDTF`
// y con dos o más a `componerDTF`.
//
// La lógica de cálculo en sí ya está cubierta por los 99 tests de `dtf.test.ts`
// y `composicion-dtf.test.ts`; aquí se comprueba el cableado: qué motor se
// elige, qué snapshot se guarda y qué se muestra en pantalla.

import { describe, expect, it } from "vitest";
import type { createClient } from "@/lib/supabase/server";
import { calcularLinea, ErrorCalculo, previsualizarDTF } from "./calcular-linea";
import type { DatosLineaWizard, LogoDTFWizard } from "@/types/presupuestos";

type SupabaseServerClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// Doble de Supabase
// ---------------------------------------------------------------------------

/** Configuración vigente en la semilla del proyecto (CLAUDE.md 6.2). */
const TABLAS: Record<string, Record<string, unknown>[]> = {
  tecnicas: [{ id: "tec-dtf", codigo: "DTF" }],
  tramos_margen: [
    { tecnica_id: "tec-dtf", tipo_cliente: "esporadico", desde_cantidad: 1, hasta_cantidad: 9, margen_pct: 60 },
    { tecnica_id: "tec-dtf", tipo_cliente: "esporadico", desde_cantidad: 10, hasta_cantidad: 99, margen_pct: 50 },
    { tecnica_id: "tec-dtf", tipo_cliente: "esporadico", desde_cantidad: 100, hasta_cantidad: 499, margen_pct: 40 },
    { tecnica_id: "tec-dtf", tipo_cliente: "esporadico", desde_cantidad: 500, hasta_cantidad: null, margen_pct: 30 },
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
  parametros_serigrafia: [{ vectorizacion: 35 }],
};

/**
 * Cliente de Supabase falso: soporta las cadenas que usa el puente
 * (`select().eq().single()`, `select().eq().eq().order()`, `select().limit()`)
 * filtrando en memoria por los `eq` acumulados.
 */
function supabaseFalso(): SupabaseServerClient {
  function from(tabla: string) {
    const filtros: [string, unknown][] = [];

    function filas(): Record<string, unknown>[] {
      return (TABLAS[tabla] ?? []).filter((fila) =>
        filtros.every(([campo, valor]) => fila[campo] === valor),
      );
    }

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
      // Thenable: `await supabase.from(x).select(y).eq(...)` devuelve la lista.
      then: (resolver: (valor: { data: unknown[] }) => unknown) =>
        resolver({ data: filas() }),
    };

    return api;
  }

  return { from } as unknown as SupabaseServerClient;
}

const CLIENTE = { tipo_cliente: "esporadico", descuento_bordado_pct: 0 } as const;

function logo(parcial: Partial<LogoDTFWizard> = {}): LogoDTFWizard {
  return {
    posicion: "pecho",
    ancho_cm: 9,
    alto_cm: 4,
    rotable: false,
    ...parcial,
  };
}

function datos(
  logos: LogoDTFWizard[],
  opciones: { cantidad?: number; vectorizacion?: boolean } = {},
): DatosLineaWizard {
  return {
    cantidad: opciones.cantidad ?? 120,
    prenda_id: null,
    color: null,
    color_grupo: null,
    detalles: {
      tecnica: "DTF",
      logos,
      incluir_vectorizacion: opciones.vectorizacion ?? false,
    },
  };
}

function snapshotDe(detalleCalculo: unknown): Record<string, unknown> {
  return detalleCalculo as Record<string, unknown>;
}

// ---------------------------------------------------------------------------

describe("elección de motor DTF según el número de logos", () => {
  it("con un solo logo usa calcularDTF y reproduce el caso canónico", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos([logo()]),
      CLIENTE,
    );

    const snapshot = snapshotDe(resultado.tecnica.detalle_calculo);
    expect(snapshot.tecnica).toBe("DTF");
    // 120 uds, logo de 9×4 en pecho: CLAUDE.md 7.2 y sección 13.6.
    expect(resultado.tecnica.importe_linea).toBe(59.54);
    expect(resultado.tecnica.precio_unitario).toBe(0.5);
    expect(resultado.tecnica.descripcion).toBe("Impresión DTF en pecho");
  });

  it("con dos logos usa componerDTF y empaqueta las dos tiradas juntas", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos([
        logo({ posicion: "pecho", ancho_cm: 9, alto_cm: 4 }),
        logo({ posicion: "espalda", ancho_cm: 25, alto_cm: 30 }),
      ]),
      CLIENTE,
    );

    const snapshot = snapshotDe(resultado.tecnica.detalle_calculo);
    expect(snapshot.tecnica).toBe("DTF_COMPOSICION");

    // Cada logo se estampa sobre las 120 prendas: 240 unidades en el rollo.
    const inputs = snapshot.inputs as { cantidad_total: number };
    expect(inputs.cantidad_total).toBe(240);

    const composicion = snapshot.composicion as { metros_necesarios: number };
    expect(composicion.metros_necesarios).toBeGreaterThan(0);

    expect(resultado.tecnica.descripcion).toBe(
      "Impresión DTF compuesta (2 logos)",
    );
  });

  it("guarda en el snapshot los logos tal como se escribieron", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos([
        logo({ posicion: "pecho", ancho_cm: 9, alto_cm: 4 }),
        logo({ posicion: "espalda", ancho_cm: 25, alto_cm: 30, rotable: true }),
      ]),
      CLIENTE,
    );

    const snapshot = snapshotDe(resultado.tecnica.detalle_calculo);
    const wizard = snapshot.wizard as {
      cantidad_prendas: number;
      logos: LogoDTFWizard[];
    };

    expect(wizard.cantidad_prendas).toBe(120);
    expect(wizard.logos).toEqual([
      { posicion: "pecho", ancho_cm: 9, alto_cm: 4, rotable: false },
      { posicion: "espalda", ancho_cm: 25, alto_cm: 30, rotable: true },
    ]);
    // La línea guarda las medidas del primer logo en sus columnas propias.
    expect(resultado.tecnica.ancho_logo_cm).toBe(9);
    expect(resultado.tecnica.posicion).toBe("pecho");
  });

  it("el precio unitario de una línea compuesta es por prenda, no por logo", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos([
        logo({ ancho_cm: 9, alto_cm: 4 }),
        logo({ posicion: "espalda", ancho_cm: 20, alto_cm: 25 }),
      ]),
      CLIENTE,
    );

    const esperado =
      Math.round((resultado.tecnica.importe_linea / 120) * 100) / 100;
    expect(resultado.tecnica.precio_unitario).toBe(esperado);
    expect(resultado.tecnica.cantidad).toBe(120);
  });

  it("añade la vectorización como línea extra también en composición", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos(
        [logo({ ancho_cm: 9, alto_cm: 4 }), logo({ ancho_cm: 12, alto_cm: 6 })],
        { vectorizacion: true },
      ),
      CLIENTE,
    );

    expect(resultado.extras).toHaveLength(1);
    expect(resultado.extras[0].descripcion).toBe("Vectorización");
    expect(resultado.extras[0].importe_linea).toBe(35);
    // El extra no se suma al importe de la línea de técnica.
    expect(resultado.preview.total).toBe(
      resultado.tecnica.importe_linea + 35,
    );
  });

  it("propaga los avisos del bin packing al preview sin bloquear", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos([
        logo({ posicion: "pecho", ancho_cm: 10, alto_cm: 20, rotable: false }),
        logo({ posicion: "espalda", ancho_cm: 9, alto_cm: 4 }),
      ]),
      CLIENTE,
    );

    expect(resultado.preview.warnings.length).toBeGreaterThan(0);
    expect(resultado.preview.warnings.join(" ")).toContain("rotar");
    // Aviso, no error: la línea se calcula igualmente.
    expect(resultado.tecnica.importe_linea).toBeGreaterThan(0);
  });

  it("un único logo rotable se tumba para que quepa en el rollo", async () => {
    const resultado = await calcularLinea(
      supabaseFalso(),
      datos([logo({ ancho_cm: 40, alto_cm: 20, rotable: true })]),
      CLIENTE,
    );

    const snapshot = snapshotDe(resultado.tecnica.detalle_calculo);
    // Sigue siendo el motor simple: un logo nunca pasa por el bin packing.
    expect(snapshot.tecnica).toBe("DTF");

    // El motor recibe las medidas ya tumbadas (20 cm caben en el rollo de 35)…
    const inputs = snapshot.inputs as {
      ancho_logo_cm: number;
      alto_logo_cm: number;
    };
    expect(inputs.ancho_logo_cm).toBe(20);
    expect(inputs.alto_logo_cm).toBe(40);

    // …pero el snapshot conserva el logo tal como se estampa sobre la prenda.
    const wizard = snapshot.wizard as { logos: LogoDTFWizard[] };
    expect(wizard.logos[0].ancho_cm).toBe(40);
  });

  it("rechaza una línea con más de diez logos", async () => {
    const muchos = Array.from({ length: 11 }, () => logo());

    await expect(
      calcularLinea(supabaseFalso(), datos(muchos), CLIENTE),
    ).rejects.toBeInstanceOf(ErrorCalculo);
  });
});

describe("previsualizarDTF (cálculo en vivo del paso 4)", () => {
  it("con un logo no informa de eficiencia: solo la mide el bin packing", async () => {
    const preview = await previsualizarDTF(
      supabaseFalso(),
      [logo()],
      120,
      "esporadico",
    );

    expect(preview.modo).toBe("DTF");
    expect(preview.eficiencia_pct).toBeNull();
    expect(preview.cantidad_total_logos).toBe(120);
    expect(preview.precio_total).toBe(59.54);
  });

  it("con dos logos devuelve metros, eficiencia y precio medio por logo", async () => {
    const logos = [
      logo({ posicion: "pecho", ancho_cm: 9, alto_cm: 4 }),
      logo({ posicion: "espalda", ancho_cm: 25, alto_cm: 30 }),
    ];
    const preview = await previsualizarDTF(
      supabaseFalso(),
      logos,
      120,
      "esporadico",
    );

    expect(preview.modo).toBe("DTF_COMPOSICION");
    expect(preview.cantidad_total_logos).toBe(240);
    expect(preview.metros_necesarios).toBeGreaterThan(0);
    expect(preview.eficiencia_pct).toBeGreaterThan(0);
    expect(preview.precio_promedio_por_logo).toBe(
      Math.round((preview.precio_total / 240) * 100) / 100,
    );
    // El unitario del PDF reparte entre prendas, no entre logos.
    expect(preview.precio_por_prenda).toBe(
      Math.round((preview.precio_total / 120) * 100) / 100,
    );
  });

  it("coincide con lo que acabaría guardándose en la línea", async () => {
    const logos = [
      logo({ ancho_cm: 9, alto_cm: 4 }),
      logo({ posicion: "espalda", ancho_cm: 20, alto_cm: 25 }),
    ];

    const preview = await previsualizarDTF(
      supabaseFalso(),
      logos,
      120,
      "esporadico",
    );
    const linea = await calcularLinea(supabaseFalso(), datos(logos), CLIENTE);

    expect(preview.precio_total).toBe(linea.tecnica.importe_linea);
    expect(preview.coste_interno).toBe(linea.tecnica.coste_interno);
  });
});
