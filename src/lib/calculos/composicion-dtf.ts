// Composición DTF — bin packing 2D de varios logos en el mismo rollo.
//
// Es el trabajo que hoy hace Josefa a mano en Corel: encajar "100 de este, 20
// de este y 3 de este" en el menor número de metros de rollo posible.
//
// Módulo INDEPENDIENTE de `calcularDTF` (CLAUDE.md 7.2), que solo sabe de un
// único tamaño de logo por línea. Aquí el consumo de rollo no sale de una
// división, sino de resolver el empaquetado y medir la altura ocupada.
//
// Algoritmo: **Shelf con First-Fit Decreasing (FFD)**. El rollo se divide en
// "estanterías" horizontales apiladas; los logos se ordenan de mayor a menor
// altura y se colocan de izquierda a derecha en la primera que tenga hueco.
//
// El bin packing 2D es NP-hard: Shelf+FFD NO da el óptimo matemático, pero da
// una solución muy buena para el caso real de Ancora (2–5 tamaños distintos
// por plantilla), es O(n·estanterías) y —lo importante para presupuestar— es
// determinista: el mismo input produce siempre el mismo layout y el mismo
// precio. Guillotine o Skyline serían sobreingeniería aquí.

import { aplicarMargen, aplicarMinimoTrabajo, redondear2 } from "./helpers";
import {
  VERSION_CALCULO,
  type ComposicionResultado,
  type DtfComposicionConfig,
  type LogoColocado,
  type LogoInput,
} from "./types";

/** Redondeo a 1 decimal, para el porcentaje de eficiencia. */
function redondear1(n: number): number {
  return Math.round(Number((n * 10).toPrecision(12))) / 10;
}

/** Etiqueta del logo para los mensajes de error: prefiere el nombre al id. */
function etiquetaLogo(logo: LogoInput): string {
  return logo.nombre ?? logo.id;
}

/**
 * Una unidad física a colocar: un logo concreto con su orientación ya
 * decidida. Un `LogoInput` con `cantidad = 20` produce 20 unidades.
 */
interface Unidad {
  logo_id: string;
  nombre?: string;
  /** Ancho aplicado (ya rotado si procede). */
  ancho: number;
  /** Alto aplicado (ya rotado si procede). */
  alto: number;
  rotado: boolean;
  /** Orden de expansión. Solo se usa para desempatar y garantizar determinismo. */
  orden: number;
}

/** Estantería horizontal abierta en el rollo. */
interface Estanteria {
  /** Coordenada Y de su borde superior. */
  y_inicio: number;
  /** Fijada por el primer logo que entra (el más alto, por el orden FFD). */
  altura: number;
  /** Siguiente X libre. */
  x_actual: number;
  /** Suma de anchos de los logos colocados, sin contar márgenes. */
  ancho_ocupado: number;
}

/** Orientación elegida para un logo. */
interface Orientacion {
  ancho: number;
  alto: number;
  rotado: boolean;
}

/**
 * Decide cómo se coloca un logo.
 *
 * Criterio: **minimizar la altura** que consume, porque el rollo se paga por
 * metro lineal y la altura es lo que se acumula. Es decir, se deja la
 * dimensión mayor en horizontal aprovechando el ancho del rollo. Un logo de
 * 5×20 rotable se coloca como 20×5.
 *
 * Excepción: si la orientación óptima no cabe a lo ancho del rollo, se prueba
 * la otra (un 40×20 rotable acaba colocado como 20×40, rotado).
 *
 * Los logos con `rotable: false` NUNCA se rotan, aunque saliera más barato.
 */
function elegirOrientacion(logo: LogoInput, anchoUtil: number): Orientacion {
  const sinRotar: Orientacion = {
    ancho: logo.ancho_cm,
    alto: logo.alto_cm,
    rotado: false,
  };

  if (!logo.rotable) {
    if (sinRotar.ancho > anchoUtil) {
      throw new Error(
        `El logo '${etiquetaLogo(logo)}' es demasiado ancho para el rollo (${logo.ancho_cm} cm > ${redondear2(anchoUtil)} cm).`,
      );
    }
    return sinRotar;
  }

  const rotado: Orientacion = {
    ancho: logo.alto_cm,
    alto: logo.ancho_cm,
    rotado: true,
  };

  // Preferida = la de menor altura. En caso de empate (logo cuadrado) se deja
  // sin rotar, para que el resultado sea estable y el layout más legible.
  const preferida = logo.alto_cm > logo.ancho_cm ? rotado : sinRotar;
  const alternativa = preferida === rotado ? sinRotar : rotado;

  if (preferida.ancho <= anchoUtil) return preferida;
  if (alternativa.ancho <= anchoUtil) return alternativa;

  // Rotable, pero ninguna de las dos orientaciones cabe: mismo error.
  throw new Error(
    `El logo '${etiquetaLogo(logo)}' es demasiado ancho para el rollo (${Math.min(logo.ancho_cm, logo.alto_cm)} cm > ${redondear2(anchoUtil)} cm).`,
  );
}

/** Valida los inputs y los expande a unidades individuales ya orientadas. */
function expandirUnidades(
  logos: LogoInput[],
  anchoUtil: number,
): Unidad[] {
  const unidades: Unidad[] = [];
  let orden = 0;

  for (const logo of logos) {
    if (logo.ancho_cm <= 0 || logo.alto_cm <= 0) {
      throw new Error(
        `Las medidas del logo '${etiquetaLogo(logo)}' deben ser mayores que cero.`,
      );
    }
    if (!Number.isInteger(logo.cantidad) || logo.cantidad <= 0) {
      throw new Error(
        `Cantidad inválida para el logo '${etiquetaLogo(logo)}': debe ser un número entero mayor que cero.`,
      );
    }

    const orientacion = elegirOrientacion(logo, anchoUtil);

    for (let i = 0; i < logo.cantidad; i += 1) {
      unidades.push({
        logo_id: logo.id,
        nombre: logo.nombre,
        ancho: orientacion.ancho,
        alto: orientacion.alto,
        rotado: orientacion.rotado,
        orden: orden,
      });
      orden += 1;
    }
  }

  return unidades;
}

/**
 * Coloca las unidades en estanterías (Shelf + First-Fit Decreasing).
 *
 * Determinismo: se ordena por alto ↓, luego ancho ↓, y finalmente por orden de
 * expansión ↑ para que no queden empates resueltos por el motor de JS.
 */
function empaquetar(
  unidades: Unidad[],
  config: DtfComposicionConfig,
): { layout: LogoColocado[]; estanterias: Estanteria[] } {
  const margen = config.margen_seguridad_cm;

  const ordenadas = [...unidades].sort((a, b) => {
    if (b.alto !== a.alto) return b.alto - a.alto;
    if (b.ancho !== a.ancho) return b.ancho - a.ancho;
    return a.orden - b.orden;
  });

  const estanterias: Estanteria[] = [];
  const layout: LogoColocado[] = [];

  for (const unidad of ordenadas) {
    // First-fit: la primera estantería (de arriba abajo) donde quepa a lo ancho.
    let destino = estanterias.find(
      (estanteria) =>
        estanteria.x_actual + unidad.ancho + margen <= config.ancho_rollo_cm,
    );

    if (!destino) {
      // Ninguna sirve: se abre una estantería nueva debajo de la última. Su
      // altura la fija esta unidad, que por el orden FFD es la más alta que
      // llegará a contener.
      const ultima = estanterias[estanterias.length - 1];
      const yInicio = ultima
        ? ultima.y_inicio + ultima.altura + margen
        : margen;

      destino = {
        y_inicio: yInicio,
        altura: unidad.alto,
        x_actual: margen,
        ancho_ocupado: 0,
      };
      estanterias.push(destino);
    }

    layout.push({
      logo_id: unidad.logo_id,
      ...(unidad.nombre !== undefined ? { nombre: unidad.nombre } : {}),
      x_cm: redondear2(destino.x_actual),
      y_cm: redondear2(destino.y_inicio),
      ancho_cm: redondear2(unidad.ancho),
      alto_cm: redondear2(unidad.alto),
      rotado: unidad.rotado,
    });

    destino.x_actual += unidad.ancho + margen;
    destino.ancho_ocupado += unidad.ancho;
  }

  return { layout, estanterias };
}

/**
 * Avisos no bloqueantes que la UI del wizard puede mostrar a Sonia.
 * No alteran el precio: son sugerencias para ahorrar rollo.
 */
function construirWarnings(
  logos: LogoInput[],
  estanterias: Estanteria[],
  eficienciaPct: number,
  config: DtfComposicionConfig,
): string[] {
  const warnings: string[] = [];
  const anchoUtil = config.ancho_rollo_cm - 2 * config.margen_seguridad_cm;

  if (eficienciaPct < 60) {
    warnings.push(
      `El aprovechamiento del rollo es bajo (${eficienciaPct} %). Revisa si algún logo puede rotarse o si conviene agrupar más unidades.`,
    );
  }

  // Un logo no rotable más alto que ancho desperdicia rollo: tumbado ocuparía
  // menos metros lineales. Solo se avisa si tumbado cabría a lo ancho.
  for (const logo of logos) {
    if (
      !logo.rotable &&
      logo.alto_cm > logo.ancho_cm &&
      logo.alto_cm <= anchoUtil
    ) {
      warnings.push(
        `El logo '${etiquetaLogo(logo)}' ahorraría rollo si se pudiera rotar (${logo.ancho_cm} cm de alto en vez de ${logo.alto_cm} cm). Márcalo como rotable si el diseño lo permite.`,
      );
    }
  }

  // Última fila a medias: añadir unidades ahí sale casi gratis.
  const ultima = estanterias[estanterias.length - 1];
  if (ultima && estanterias.length > 1) {
    const ocupacionPct = redondear1((ultima.ancho_ocupado / anchoUtil) * 100);
    if (ocupacionPct < 50) {
      warnings.push(
        `La última fila del rollo queda al ${ocupacionPct} % de ocupación. Añadir unidades de un logo pequeño apenas encarecería el trabajo.`,
      );
    }
  }

  return warnings;
}

/**
 * Compone varios logos de distintos tamaños en el mismo rollo de DTF y
 * devuelve el layout físico completo más el coste y el precio de venta.
 *
 * Función pura: no consulta Supabase ni depende de Next.js. Quien la llame
 * (el wizard, Prompt 6) carga `parametros_dtf` y filtra `tramos_margen` por
 * técnica DTF y tipo de cliente.
 *
 * El esquema económico es el mismo que el de `calcularDTF` (CLAUDE.md 7.2
 * pasos 4–11); lo único distinto es de dónde salen los metros. El margen se
 * busca por la cantidad TOTAL de logos, no por el número de tamaños distintos.
 *
 * @throws si no hay logos, si alguna cantidad es inválida o si algún logo no
 *         cabe a lo ancho del rollo en ninguna orientación permitida.
 */
export function componerDTF(
  logos: LogoInput[],
  config: DtfComposicionConfig,
): ComposicionResultado {
  if (logos.length === 0) {
    throw new Error("No hay logos que componer.");
  }

  // Ancho realmente utilizable: hay que dejar margen en los dos bordes.
  const anchoUtil = config.ancho_rollo_cm - 2 * config.margen_seguridad_cm;
  if (anchoUtil <= 0) {
    throw new Error(
      `El margen de seguridad (${config.margen_seguridad_cm} cm) no deja ancho utilizable en un rollo de ${config.ancho_rollo_cm} cm.`,
    );
  }

  const unidades = expandirUnidades(logos, anchoUtil);
  const cantidadTotal = unidades.length;
  if (cantidadTotal === 0) {
    throw new Error("No hay logos que componer.");
  }

  // --- Empaquetado ---------------------------------------------------------
  const { layout, estanterias } = empaquetar(unidades, config);

  const ultima = estanterias[estanterias.length - 1];
  // Altura consumida = hasta el borde inferior de la última estantería, más el
  // margen final del rollo.
  const alturaConsumida = redondear2(
    ultima.y_inicio + ultima.altura + config.margen_seguridad_cm,
  );
  const metrosNecesarios = redondear2(alturaConsumida / 100);

  const areaLogos = unidades.reduce(
    (suma, unidad) => suma + unidad.ancho * unidad.alto,
    0,
  );
  const areaRollo = config.ancho_rollo_cm * alturaConsumida;
  const eficienciaPct = redondear1((areaLogos / areaRollo) * 100);

  // --- Cálculo económico (idéntico a calcularDTF) --------------------------
  const material = redondear2(metrosNecesarios * config.precio_metro);
  const recorte = redondear2(cantidadTotal * config.recorte_por_logo);
  const minutosEstimados = Math.round(
    config.minutos_setup_fijo + config.minutos_por_logo * cantidadTotal,
  );
  const manoObra = redondear2(minutosEstimados * config.mano_obra_por_minuto);

  const subtotalSinPreparacion = redondear2(material + recorte + manoObra);
  const preparacion = redondear2(
    subtotalSinPreparacion * (config.preparacion_pct / 100),
  );
  const costeBruto = redondear2(subtotalSinPreparacion + preparacion);

  const { coste: costeInterno, aplicado: aplicadoMinimo } =
    aplicarMinimoTrabajo(costeBruto, config.minimo_trabajo);

  const margen = aplicarMargen(
    costeInterno,
    config.tramos_margen,
    cantidadTotal,
  );

  const precioTotal = margen.precio;
  const precioPromedioPorLogo = redondear2(precioTotal / cantidadTotal);

  const warnings = construirWarnings(
    logos,
    estanterias,
    eficienciaPct,
    config,
  );

  return {
    cantidad_total_logos: cantidadTotal,
    metros_necesarios: metrosNecesarios,
    eficiencia_pct: eficienciaPct,

    coste_material: material,
    coste_recorte: recorte,
    coste_mano_obra: manoObra,
    minutos_estimados: minutosEstimados,
    coste_interno: costeInterno,
    aplicado_minimo: aplicadoMinimo,

    margen_aplicado_pct: margen.margen_pct,
    precio_total: precioTotal,
    precio_promedio_por_logo: precioPromedioPorLogo,

    layout,
    warnings,

    detalle_calculo: {
      tecnica: "DTF_COMPOSICION",
      version_calculo: VERSION_CALCULO,
      inputs: {
        // Copia defensiva: el snapshot debe ser inmutable aunque el llamante
        // siga manipulando su array de logos.
        logos: logos.map((logo) => ({ ...logo })),
        cantidad_total: cantidadTotal,
      },
      parametros_aplicados: {
        ancho_rollo_cm: config.ancho_rollo_cm,
        precio_metro: config.precio_metro,
        recorte_por_logo: config.recorte_por_logo,
        mano_obra_por_minuto: config.mano_obra_por_minuto,
        preparacion_pct: config.preparacion_pct,
        minimo_trabajo: config.minimo_trabajo,
        margen_seguridad_cm: config.margen_seguridad_cm,
        minutos_setup_fijo: config.minutos_setup_fijo,
        minutos_por_logo: config.minutos_por_logo,
      },
      composicion: {
        algoritmo: "shelf_ffd",
        num_estanterias: estanterias.length,
        metros_necesarios: metrosNecesarios,
        eficiencia_pct: eficienciaPct,
        altura_consumida_cm: alturaConsumida,
      },
      calculo: {
        material,
        recorte,
        minutos_estimados: minutosEstimados,
        mano_obra: manoObra,
        subtotal_sin_preparacion: subtotalSinPreparacion,
        preparacion,
        coste_interno: costeInterno,
        aplicado_minimo: aplicadoMinimo,
      },
      comercial: {
        tramo_cantidad: margen.tramo,
        margen_pct: margen.margen_pct,
        precio_total: precioTotal,
        precio_promedio_por_logo: precioPromedioPorLogo,
      },
      layout,
    },
  };
}
