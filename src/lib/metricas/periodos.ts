// Rangos de fecha del panel de métricas (Prompt 10).
//
// Todas las funciones son puras y trabajan con fechas ISO `YYYY-MM-DD` en el
// calendario de MADRID, no en UTC.
//
// Por qué strings y no objetos `Date`: la columna por la que se filtra
// (`presupuestos.fecha_emision`) es un `date` de Postgres, un día natural sin
// hora ni zona. Convertirlo a `Date` obligaría a volver a decidir a qué
// instante corresponde ese día — que es exactamente el paso donde el Prompt 9
// encontró el bug de la hora de Madrid. Manteniendo el día natural como texto,
// el filtro es una comparación de calendario y no hay ambigüedad posible.
//
// El único punto que sí depende de la zona horaria es "qué día es hoy": a las
// 01:00 del 1 de agosto en Madrid son todavía las 23:00 del 31 de julio en UTC,
// y el mes en curso debe ser agosto. De ahí `hoyEnMadrid`.

import { sumarDiasISO } from "@/lib/format";
// Reutilizadas del Prompt 9 (mismo criterio de zona horaria, un solo sitio que
// mantener): `fechaEnMadrid` traduce un instante al día natural de Madrid y
// `rangoMesAnterior` ya devuelve el mes natural anterior completo.
import {
  fechaEnMadrid,
  rangoMesAnterior as rangoMesAnteriorExportacion,
} from "@/lib/exportacion/consultas";

/** Rango de días naturales, ambos extremos inclusive, en formato `YYYY-MM-DD`. */
export interface RangoFechas {
  desde: string;
  hasta: string;
}

/** Identificador del período elegido en el selector de la pantalla. */
export type ClavePeriodo =
  | "mes_actual"
  | "mes_anterior"
  | "trimestre"
  | "ano"
  | "custom";

export const PERIODO_POR_DEFECTO: ClavePeriodo = "mes_actual";

export const ETIQUETAS_PERIODO: Record<ClavePeriodo, string> = {
  mes_actual: "Mes actual",
  mes_anterior: "Mes anterior",
  trimestre: "Este trimestre",
  ano: "Año en curso",
  custom: "Rango personalizado",
};

/** Día de hoy en el calendario de Madrid, `YYYY-MM-DD`. */
export function hoyEnMadrid(ahora: Date = new Date()): string {
  // `fechaEnMadrid` solo devuelve null con una fecha inválida; `new Date()` no
  // lo es, y el respaldo evita propagar un null imposible por toda la app.
  return fechaEnMadrid(ahora.toISOString()) ?? ahora.toISOString().slice(0, 10);
}

/** Primer día del mes al que pertenece una fecha ISO. */
function primerDiaDelMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Desde el día 1 del mes en curso hasta hoy (ambos en hora de Madrid). */
export function rangoMesActual(ahora: Date = new Date()): RangoFechas {
  const hoy = hoyEnMadrid(ahora);
  return { desde: primerDiaDelMes(hoy), hasta: hoy };
}

/** Mes natural anterior completo, del día 1 al último día. */
export function rangoMesAnterior(ahora: Date = new Date()): RangoFechas {
  return rangoMesAnteriorExportacion(ahora);
}

/** Desde el día 1 del trimestre en curso hasta hoy. */
export function rangoTrimestreActual(ahora: Date = new Date()): RangoFechas {
  const hoy = hoyEnMadrid(ahora);
  const anio = hoy.slice(0, 4);
  const mes = Number(hoy.slice(5, 7));
  // Trimestres naturales: ene-mar, abr-jun, jul-sep, oct-dic.
  const primerMesTrimestre = Math.floor((mes - 1) / 3) * 3 + 1;
  return {
    desde: `${anio}-${String(primerMesTrimestre).padStart(2, "0")}-01`,
    hasta: hoy,
  };
}

/** Desde el 1 de enero hasta hoy. */
export function rangoAnoActual(ahora: Date = new Date()): RangoFechas {
  const hoy = hoyEnMadrid(ahora);
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
}

/** Rango correspondiente a una clave del selector. `custom` no tiene rango propio. */
export function rangoDePeriodo(
  clave: Exclude<ClavePeriodo, "custom">,
  ahora: Date = new Date(),
): RangoFechas {
  switch (clave) {
    case "mes_actual":
      return rangoMesActual(ahora);
    case "mes_anterior":
      return rangoMesAnterior(ahora);
    case "trimestre":
      return rangoTrimestreActual(ahora);
    case "ano":
      return rangoAnoActual(ahora);
  }
}

/** Nº de días naturales que abarca un rango, contando ambos extremos. */
export function diasDelRango({ desde, hasta }: RangoFechas): number {
  return diasEntre(desde, hasta) + 1;
}

/**
 * Días naturales transcurridos entre dos fechas ISO (`hasta - desde`).
 * Se parsean como medianoche UTC: al ser ambos días naturales, la resta es
 * exacta y no la afecta ningún cambio de hora.
 */
export function diasEntre(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return 0;
  return Math.round((fin - inicio) / 86_400_000);
}

/**
 * Período anterior equivalente, para la comparativa de la tarjeta de emitidos:
 * una ventana de la MISMA longitud que termina el día antes de `desde`.
 *
 * Se eligió "ventana inmediatamente anterior" y no "los mismos días del mes
 * pasado" porque es la única definición que funciona igual para los cinco
 * períodos del selector, incluido el rango personalizado, sin casos especiales.
 */
export function rangoAnterior(rango: RangoFechas): RangoFechas {
  const dias = diasDelRango(rango);
  const hasta = sumarDiasISO(rango.desde, -1);
  return { desde: sumarDiasISO(hasta, -(dias - 1)), hasta };
}

/** `true` si el rango está bien formado (dos fechas ISO y hasta >= desde). */
export function rangoValido(rango: RangoFechas): boolean {
  const FORMATO = /^\d{4}-\d{2}-\d{2}$/;
  return (
    FORMATO.test(rango.desde) &&
    FORMATO.test(rango.hasta) &&
    rango.hasta >= rango.desde
  );
}
