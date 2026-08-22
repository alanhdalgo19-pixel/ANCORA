// Tests del panel de métricas (Prompt 10).
//
// Todo lo que se prueba aquí es la capa pura: `consultas.ts` no interviene, así
// que no hace falta Supabase ni fixtures de base de datos.

import { describe, expect, it } from "vitest";
import {
  agregarMetricas,
  calcularActividad,
  calcularDistribucionTecnica,
  calcularTopClientes,
  construirAlertas,
} from "./calcularMetricas";
import {
  diasDelRango,
  rangoAnoActual,
  rangoAnterior,
  rangoMesActual,
  rangoMesAnterior,
  rangoTrimestreActual,
  hoyEnMadrid,
} from "./periodos";
import type {
  CandidatoAlerta,
  DatosMetricas,
  EstadoCatalogo,
  LineaMetrica,
  PresupuestoMetrica,
} from "./tipos";
import type { CodigoTecnica, EstadoPresupuesto } from "@/types/database";

// ---------------------------------------------------------------------------
// Constructores de datos de prueba
// ---------------------------------------------------------------------------

const ID_TECNICA: Record<CodigoTecnica, string> = {
  DTF: "tec-dtf",
  BORDADO: "tec-bordado",
  SERIGRAFIA: "tec-serigrafia",
  IMPRESION_DIRECTA: "tec-impresion",
  SUBLIMACION: "tec-sublimacion",
};

const TECNICAS = new Map<string, CodigoTecnica>(
  (Object.entries(ID_TECNICA) as [CodigoTecnica, string][]).map(
    ([codigo, id]) => [id, codigo],
  ),
);

const CATALOGO_VACIO: EstadoCatalogo = {
  prendas_sin_precio: 0,
  sublimacion_sin_tarifa: false,
  clientes_sin_datos_fiscales: 0,
};

let secuencia = 0;

function presupuesto(
  parcial: Partial<PresupuestoMetrica> & { estado: EstadoPresupuesto },
): PresupuestoMetrica {
  secuencia += 1;
  return {
    id: `p-${secuencia}`,
    numero: `2026/${String(secuencia).padStart(6, "0")}/0`,
    fecha_emision: "2026-08-10",
    total: 100,
    enviado_a_facturacion: null,
    cliente_id: "cli-1",
    cliente_nombre: "Cliente Uno",
    ...parcial,
  };
}

function linea(parcial: Partial<LineaMetrica>): LineaMetrica {
  secuencia += 1;
  return {
    id: `l-${secuencia}`,
    presupuesto_id: "p-1",
    tipo_linea: "tecnica",
    tecnica_id: ID_TECNICA.DTF,
    linea_padre_id: null,
    importe_linea: 0,
    ...parcial,
  };
}

function candidato(
  parcial: Partial<CandidatoAlerta> & { estado: EstadoPresupuesto },
): CandidatoAlerta {
  secuencia += 1;
  return {
    id: `p-${secuencia}`,
    numero: `2026/${String(secuencia).padStart(6, "0")}/0`,
    cliente_nombre: "Cliente Uno",
    fecha_emision: "2026-08-01",
    fecha_validez: "2026-08-31",
    created_at: "2026-08-01T09:00:00Z",
    ...parcial,
  };
}

function datos(parcial: Partial<DatosMetricas> = {}): DatosMetricas {
  return {
    presupuestos: [],
    emitidos_periodo_anterior: 0,
    lineas: [],
    tecnicas: TECNICAS,
    candidatos_alerta: [],
    catalogo: CATALOGO_VACIO,
    ...parcial,
  };
}

const RANGO_AGOSTO = { desde: "2026-08-01", hasta: "2026-08-31" };

// ---------------------------------------------------------------------------
// Test 1 — período vacío
// ---------------------------------------------------------------------------

describe("período sin presupuestos", () => {
  it("devuelve todo a cero y el ratio de conversión a null", () => {
    const metricas = agregarMetricas(datos(), RANGO_AGOSTO, "2026-08-22");

    expect(metricas.actividad.emitidos).toBe(0);
    expect(metricas.actividad.en_cotizacion).toBe(0);
    expect(metricas.actividad.total_aceptado).toBe(0);
    expect(metricas.actividad.ratio_conversion).toBeNull();
    // Sin período anterior con datos tampoco hay comparativa que enseñar.
    expect(metricas.actividad.variacion_emitidos_pct).toBeNull();

    expect(metricas.top_clientes.por_volumen).toEqual([]);
    expect(metricas.top_clientes.por_cantidad).toEqual([]);
    expect(metricas.distribucion_tecnica.total_presupuestos_con_tecnica).toBe(0);
    expect(metricas.alertas.sin_respuesta).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests 2 y 3 — ratio de conversión
// ---------------------------------------------------------------------------

describe("ratio de conversión", () => {
  it("es 100% con 5 aceptados y ningún rechazado", () => {
    const presupuestos = Array.from({ length: 5 }, () =>
      presupuesto({ estado: "aceptado" }),
    );

    expect(calcularActividad(presupuestos, 0).ratio_conversion).toBe(100);
  });

  it("es 30% con 3 aceptados y 7 rechazados", () => {
    const presupuestos = [
      ...Array.from({ length: 3 }, () => presupuesto({ estado: "aceptado" })),
      ...Array.from({ length: 7 }, () => presupuesto({ estado: "rechazado" })),
    ];

    expect(calcularActividad(presupuestos, 0).ratio_conversion).toBe(30);
  });

  it("no cuenta borradores ni enviados en el divisor", () => {
    // 2 aceptados / (2 aceptados + 2 caducados) = 50%, aunque haya 3 vivos.
    const presupuestos = [
      presupuesto({ estado: "aceptado" }),
      presupuesto({ estado: "aceptado" }),
      presupuesto({ estado: "caducado" }),
      presupuesto({ estado: "caducado" }),
      presupuesto({ estado: "borrador" }),
      presupuesto({ estado: "enviado" }),
      presupuesto({ estado: "enviado" }),
    ];

    expect(calcularActividad(presupuestos, 0).ratio_conversion).toBe(50);
  });
});

describe("actividad", () => {
  it("suma en cotización los enviados y los aceptados aún no facturados", () => {
    const presupuestos = [
      presupuesto({ estado: "enviado", total: 200 }),
      presupuesto({ estado: "aceptado", total: 300 }),
      presupuesto({
        estado: "aceptado",
        total: 500,
        enviado_a_facturacion: "2026-08-15T10:00:00Z",
      }),
      presupuesto({ estado: "borrador", total: 999 }),
      presupuesto({ estado: "rechazado", total: 999 }),
    ];

    const actividad = calcularActividad(presupuestos, 4);

    expect(actividad.en_cotizacion).toBe(500);
    // El aceptado ya volcado sigue contando como aceptado del período.
    expect(actividad.total_aceptado).toBe(800);
    expect(actividad.emitidos).toBe(5);
    expect(actividad.variacion_emitidos_pct).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — distribución por técnica
// ---------------------------------------------------------------------------

describe("distribución por técnica", () => {
  it("cuenta una vez por técnica presente, no una vez por línea", () => {
    const uno = presupuesto({ estado: "aceptado", id: "p-dtf-bordado" });
    const lineas = [
      linea({ presupuesto_id: uno.id, tecnica_id: ID_TECNICA.DTF }),
      linea({ presupuesto_id: uno.id, tecnica_id: ID_TECNICA.DTF }),
      linea({ presupuesto_id: uno.id, tecnica_id: ID_TECNICA.BORDADO }),
    ];

    const distribucion = calcularDistribucionTecnica([uno], lineas, TECNICAS);

    expect(distribucion.por_num_presupuestos.DTF).toBe(1);
    expect(distribucion.por_num_presupuestos.BORDADO).toBe(1);
    expect(distribucion.por_num_presupuestos.SERIGRAFIA).toBe(0);
    expect(distribucion.total_presupuestos_con_tecnica).toBe(1);
  });

  it("imputa los extras a la técnica de su línea padre y excluye las prendas", () => {
    const uno = presupuesto({ estado: "aceptado", id: "p-extras" });
    const padre = linea({
      id: "l-padre",
      presupuesto_id: uno.id,
      tecnica_id: ID_TECNICA.BORDADO,
      importe_linea: 400,
    });
    const lineas = [
      padre,
      // Picaje: cuelga del bordado, así que suma al bordado.
      linea({
        presupuesto_id: uno.id,
        tipo_linea: "extra",
        tecnica_id: ID_TECNICA.BORDADO,
        linea_padre_id: padre.id,
        importe_linea: 50,
      }),
      // La venta de la prenda no es personalización: no entra en el reparto.
      linea({
        presupuesto_id: uno.id,
        tipo_linea: "prenda",
        tecnica_id: null,
        importe_linea: 1000,
      }),
    ];

    const distribucion = calcularDistribucionTecnica([uno], lineas, TECNICAS);

    expect(distribucion.por_facturacion.BORDADO).toBe(450);
    expect(distribucion.por_facturacion.DTF).toBe(0);
    // El extra no suma presencia por su cuenta: ya la marcó su línea padre.
    expect(distribucion.por_num_presupuestos.BORDADO).toBe(1);
  });

  it("solo suma importe de los presupuestos aceptados", () => {
    const aceptado = presupuesto({ estado: "aceptado", id: "p-ok" });
    const rechazado = presupuesto({ estado: "rechazado", id: "p-ko" });
    const lineas = [
      linea({ presupuesto_id: aceptado.id, importe_linea: 100 }),
      linea({ presupuesto_id: rechazado.id, importe_linea: 900 }),
    ];

    const distribucion = calcularDistribucionTecnica(
      [aceptado, rechazado],
      lineas,
      TECNICAS,
    );

    expect(distribucion.por_facturacion.DTF).toBe(100);
    // Pero el rechazado sí cuenta para la presencia de la técnica.
    expect(distribucion.por_num_presupuestos.DTF).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Test 5 — rangos en hora de Madrid
// ---------------------------------------------------------------------------

describe("rangos de fecha en hora de Madrid", () => {
  // 2026-07-31T22:30:00Z son las 00:30 del 1 de agosto en Madrid (verano, +02).
  const MADRID_1_AGOSTO = new Date("2026-07-31T22:30:00Z");

  it("el mes actual arranca en agosto aunque en UTC siga siendo julio", () => {
    expect(hoyEnMadrid(MADRID_1_AGOSTO)).toBe("2026-08-01");
    expect(rangoMesActual(MADRID_1_AGOSTO)).toEqual({
      desde: "2026-08-01",
      hasta: "2026-08-01",
    });
  });

  it("el mes anterior es julio completo, no junio", () => {
    expect(rangoMesAnterior(MADRID_1_AGOSTO)).toEqual({
      desde: "2026-07-01",
      hasta: "2026-07-31",
    });
  });

  it("el trimestre y el año se calculan sobre el día de Madrid", () => {
    expect(rangoTrimestreActual(MADRID_1_AGOSTO)).toEqual({
      desde: "2026-07-01",
      hasta: "2026-08-01",
    });
    expect(rangoAnoActual(MADRID_1_AGOSTO)).toEqual({
      desde: "2026-01-01",
      hasta: "2026-08-01",
    });
  });

  it("también en horario de invierno (+01), en el salto de año", () => {
    // 2025-12-31T23:30:00Z son las 00:30 del 1 de enero de 2026 en Madrid.
    const madridAnoNuevo = new Date("2025-12-31T23:30:00Z");

    expect(hoyEnMadrid(madridAnoNuevo)).toBe("2026-01-01");
    expect(rangoAnoActual(madridAnoNuevo).desde).toBe("2026-01-01");
    expect(rangoMesAnterior(madridAnoNuevo)).toEqual({
      desde: "2025-12-01",
      hasta: "2025-12-31",
    });
  });

  it("el período anterior equivalente tiene la misma longitud", () => {
    const rango = { desde: "2026-08-01", hasta: "2026-08-22" };
    expect(diasDelRango(rango)).toBe(22);
    expect(rangoAnterior(rango)).toEqual({
      desde: "2026-07-10",
      hasta: "2026-07-31",
    });
    expect(diasDelRango(rangoAnterior(rango))).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// Test 6 — alertas
// ---------------------------------------------------------------------------

describe("alertas operativas", () => {
  const HOY = "2026-08-22";

  it("marca sin respuesta los enviados hace más de 20 días", () => {
    const candidatos = [
      // 22 días: entra.
      candidato({ estado: "enviado", fecha_emision: "2026-07-31" }),
      // Exactamente 20 días: todavía no, el umbral es "más de 20".
      candidato({ estado: "enviado", fecha_emision: "2026-08-02" }),
      // 5 días: recién enviado.
      candidato({ estado: "enviado", fecha_emision: "2026-08-17" }),
    ];

    const { sin_respuesta } = construirAlertas(candidatos, HOY);

    expect(sin_respuesta).toHaveLength(1);
    expect(sin_respuesta[0].fecha).toBe("2026-07-31");
    expect(sin_respuesta[0].dias).toBe(22);
  });

  it("marca olvidados los borradores de más de 7 días y respeta la hora de Madrid", () => {
    const candidatos = [
      // Creado el 2026-08-01 en Madrid (23:30Z del 31 de julio): 21 días.
      candidato({ estado: "borrador", created_at: "2026-07-31T23:30:00Z" }),
      // 7 días justos: no entra.
      candidato({ estado: "borrador", created_at: "2026-08-15T10:00:00Z" }),
      // 8 días: entra.
      candidato({ estado: "borrador", created_at: "2026-08-14T10:00:00Z" }),
    ];

    const { borradores_olvidados } = construirAlertas(candidatos, HOY);

    expect(borradores_olvidados.map((item) => item.dias)).toEqual([21, 8]);
    expect(borradores_olvidados[0].fecha).toBe("2026-08-01");
  });

  it("lista los caducados por su fecha de validez, sin umbral de días", () => {
    const candidatos = [
      candidato({
        estado: "caducado",
        fecha_emision: "2026-08-20",
        fecha_validez: "2026-08-21",
      }),
    ];

    const { caducados } = construirAlertas(candidatos, HOY);

    expect(caducados).toHaveLength(1);
    expect(caducados[0].fecha).toBe("2026-08-21");
    expect(caducados[0].dias).toBe(1);
  });

  it("ordena por antigüedad y corta a 10 elementos", () => {
    const candidatos = Array.from({ length: 15 }, (_, indice) =>
      candidato({
        estado: "enviado",
        // Del 2026-07-01 en adelante: todos superan los 20 días.
        fecha_emision: `2026-07-${String(indice + 1).padStart(2, "0")}`,
      }),
    );

    const { sin_respuesta } = construirAlertas(candidatos, HOY);

    expect(sin_respuesta).toHaveLength(10);
    expect(sin_respuesta[0].fecha).toBe("2026-07-01");
    expect(sin_respuesta[0].dias).toBeGreaterThan(sin_respuesta[9].dias);
  });
});

// ---------------------------------------------------------------------------
// Top clientes
// ---------------------------------------------------------------------------

describe("top clientes", () => {
  it("ordena por volumen aceptado y por número de presupuestos", () => {
    const presupuestos = [
      presupuesto({
        estado: "aceptado",
        cliente_id: "cli-a",
        cliente_nombre: "Doyle Náutica",
        total: 1000,
      }),
      presupuesto({
        estado: "aceptado",
        cliente_id: "cli-b",
        cliente_nombre: "Formentera Lines",
        total: 300,
      }),
      presupuesto({
        estado: "rechazado",
        cliente_id: "cli-b",
        cliente_nombre: "Formentera Lines",
        total: 5000,
      }),
      presupuesto({
        estado: "borrador",
        cliente_id: "cli-b",
        cliente_nombre: "Formentera Lines",
        total: 5000,
      }),
    ];

    const top = calcularTopClientes(presupuestos);

    // Por volumen solo cuentan los aceptados: Doyle 1000 € por delante.
    expect(top.por_volumen.map((cliente) => cliente.nombre)).toEqual([
      "Doyle Náutica",
      "Formentera Lines",
    ]);
    // Por cantidad cuentan todos los estados: Formentera con 3.
    expect(top.por_cantidad[0]).toMatchObject({
      nombre: "Formentera Lines",
      num_presupuestos: 3,
    });
  });
});
