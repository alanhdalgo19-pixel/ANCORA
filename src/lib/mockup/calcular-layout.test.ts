import { describe, expect, it } from "vitest";
import {
  AVISO_EXCEDE_AREA,
  AVISO_UBICACION_NO_DISPONIBLE,
  calcularLayoutMockup,
  type AreaLayout,
  type EntradaLayoutMockup,
} from "./calcular-layout";
import { DIMENSIONES_PRENDAS } from "./dimensiones-prendas";

const URL_LOGO = "/api/logos/00000000-0000-0000-0000-000000000001";

function entrada(
  cambios: Partial<EntradaLayoutMockup> = {},
): EntradaLayoutMockup {
  return {
    tipo_prenda: "polo",
    color_prenda: "color",
    logo_url: URL_LOGO,
    logo_ancho_cm: 9,
    logo_alto_cm: 4,
    ubicacion: "pecho",
    ...cambios,
  };
}

function areaDisponible(area: ReturnType<typeof calcularLayoutMockup>["area"]): AreaLayout {
  if (!area.disponible) throw new Error("Se esperaba un área disponible");
  return area;
}

describe("calcularLayoutMockup", () => {
  it("polo con logo pecho 9×4: escala correcta, logo dentro del área y sin avisos", () => {
    const layout = calcularLayoutMockup(entrada());
    const polo = DIMENSIONES_PRENDAS.polo;

    // 400 px de alto para 70 cm de prenda.
    expect(layout.escala_px_por_cm).toBeCloseTo(400 / 70, 10);
    expect(layout.svg_alto_px).toBeCloseTo(400, 10);
    expect(layout.svg_ancho_px).toBeCloseTo(50 * (400 / 70), 10);
    expect(layout.warnings).toEqual([]);
    expect(layout.etiqueta_dimensiones).toBe("9 × 4 cm");

    const area = areaDisponible(layout.area);
    const logo = layout.logo!;
    expect(logo.excede_area).toBe(false);
    expect(logo.tiene_url).toBe(true);
    expect(logo.ancho_px).toBeCloseTo(9 * layout.escala_px_por_cm, 10);
    expect(logo.alto_px).toBeCloseTo(4 * layout.escala_px_por_cm, 10);

    // Centrado horizontal y 2 cm de margen superior.
    expect(logo.x_px + logo.ancho_px / 2).toBeCloseTo(
      area.x_px + area.ancho_px / 2,
      10,
    );
    expect(logo.y_px).toBeCloseTo(
      (polo.area_imprimible_pecho!.y_cm + 2) * layout.escala_px_por_cm,
      10,
    );

    // Dentro del área por los cuatro lados.
    expect(logo.x_px).toBeGreaterThanOrEqual(area.x_px);
    expect(logo.y_px).toBeGreaterThanOrEqual(area.y_px);
    expect(logo.x_px + logo.ancho_px).toBeLessThanOrEqual(area.x_px + area.ancho_px);
    expect(logo.y_px + logo.alto_px).toBeLessThanOrEqual(area.y_px + area.alto_px);
  });

  it("camiseta con logo espalda 25×30: usa el área de espalda y la vista trasera", () => {
    const layout = calcularLayoutMockup(
      entrada({ tipo_prenda: "camiseta", ubicacion: "espalda", logo_ancho_cm: 25, logo_alto_cm: 30 }),
    );
    const espalda = DIMENSIONES_PRENDAS.camiseta.area_imprimible_espalda!;
    const area = areaDisponible(layout.area);

    expect(layout.vista).toBe("trasera");
    expect(layout.banda_trasera_alto_px).toBeGreaterThan(0);
    expect(area.etiqueta).toBe("ESPALDA");
    expect(area.ancho_cm).toBe(espalda.ancho_max_cm);
    expect(area.alto_cm).toBe(espalda.alto_max_cm);
    expect(area.y_px).toBeCloseTo(espalda.y_cm * layout.escala_px_por_cm, 10);

    expect(layout.logo!.ancho_cm).toBe(25);
    expect(layout.logo!.alto_cm).toBe(30);
    expect(layout.logo!.excede_area).toBe(false);
    expect(layout.etiqueta_dimensiones).toBe("25 × 30 cm");
    expect(layout.warnings).toEqual([]);
  });

  it("polo con logo pecho 20×20: avisa de que excede el área imprimible", () => {
    const layout = calcularLayoutMockup(
      entrada({ logo_ancho_cm: 20, logo_alto_cm: 20 }),
    );

    expect(layout.logo!.excede_area).toBe(true);
    expect(layout.warnings).toHaveLength(1);
    expect(layout.warnings[0]).toContain(AVISO_EXCEDE_AREA);
  });

  it("chaleco con ubicación manga: área no disponible y sin logo", () => {
    const layout = calcularLayoutMockup(
      entrada({ tipo_prenda: "chaleco", ubicacion: "manga" }),
    );

    expect(layout.area.disponible).toBe(false);
    expect(layout.logo).toBeNull();
    expect(layout.warnings).toEqual([AVISO_UBICACION_NO_DISPONIBLE]);
  });

  it("logo con URL null: tiene_url = false y se sigue colocando a escala", () => {
    const layout = calcularLayoutMockup(entrada({ logo_url: null }));

    expect(layout.logo!.tiene_url).toBe(false);
    expect(layout.logo!.url).toBeNull();
    expect(layout.logo!.ancho_px).toBeCloseTo(9 * layout.escala_px_por_cm, 10);
    expect(layout.warnings).toEqual([]);
  });

  it("alto_pixels de 400 a 800: todas las dimensiones se duplican", () => {
    const a = calcularLayoutMockup(entrada({ alto_pixels: 400 }));
    const b = calcularLayoutMockup(entrada({ alto_pixels: 800 }));
    const areaA = areaDisponible(a.area);
    const areaB = areaDisponible(b.area);

    expect(b.escala_px_por_cm).toBeCloseTo(a.escala_px_por_cm * 2, 10);
    expect(b.svg_ancho_px).toBeCloseTo(a.svg_ancho_px * 2, 10);
    expect(b.svg_alto_px).toBeCloseTo(a.svg_alto_px * 2, 10);
    for (const clave of ["x_px", "y_px", "ancho_px", "alto_px"] as const) {
      expect(areaB[clave]).toBeCloseTo(areaA[clave] * 2, 10);
    }
    for (const clave of [
      "x_px",
      "y_px",
      "ancho_px",
      "alto_px",
      "etiqueta_x_px",
      "etiqueta_y_px",
    ] as const) {
      expect(b.logo![clave]).toBeCloseTo(a.logo![clave] * 2, 10);
    }
    expect(b.tamano_fuente_etiqueta_px).toBeCloseTo(a.tamano_fuente_etiqueta_px * 2, 10);
    // Las medidas reales no cambian.
    expect(b.logo!.ancho_cm).toBe(a.logo!.ancho_cm);
    expect(b.etiqueta_dimensiones).toBe(a.etiqueta_dimensiones);
  });

  it("color de prenda oscuro: fondo gris oscuro y texto claro", () => {
    const layout = calcularLayoutMockup(entrada({ color_prenda: "oscuro" }));

    expect(layout.prenda.color).toBe("oscuro");
    expect(layout.prenda.color_fondo).toBe("#333333");
    expect(layout.prenda.color_texto).toBe("#fafafa");
  });

  it("ubicación 'otro' con polo: usa el área de pecho como respaldo con etiqueta OTRO", () => {
    const layout = calcularLayoutMockup(entrada({ ubicacion: "otro" }));
    const pecho = calcularLayoutMockup(entrada({ ubicacion: "pecho" }));
    const area = areaDisponible(layout.area);
    const areaPecho = areaDisponible(pecho.area);

    expect(area.etiqueta).toBe("OTRO");
    expect(layout.vista).toBe("delantera");
    expect(area.x_px).toBe(areaPecho.x_px);
    expect(area.y_px).toBe(areaPecho.y_px);
    expect(area.ancho_cm).toBe(areaPecho.ancho_cm);
    expect(area.alto_cm).toBe(areaPecho.alto_cm);
    expect(layout.logo!.y_px).toBe(pecho.logo!.y_px);
  });
});
