// Formateo de importes, fechas y cantidades para la UI y el preview del PDF.
// Locale fijo "es-ES": la aplicación es solo para Ancora y el PDF es español.

const FORMATO_EUROS = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FORMATO_EUROS_UNITARIO = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FORMATO_FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** 1234.5 → "1.234,50 €" */
export function formatEuros(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  return FORMATO_EUROS.format(Number.isFinite(numero) ? numero : 0);
}

/** Igual que `formatEuros`; alias semántico para precios unitarios. */
export function formatEurosUnitario(
  valor: number | string | null | undefined,
): string {
  const numero = Number(valor ?? 0);
  return FORMATO_EUROS_UNITARIO.format(Number.isFinite(numero) ? numero : 0);
}

/** "2026-07-25" → "25/07/2026". Se trata como fecha sin hora (UTC). */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const fecha = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return FORMATO_FECHA.format(fecha);
}

/** Fecha de hoy en formato `YYYY-MM-DD` (columna `date` de Postgres). */
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Suma días a una fecha ISO `YYYY-MM-DD` y devuelve el mismo formato. */
export function sumarDiasISO(iso: string, dias: number): string {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** 9.5 → "9,5" (medidas en cm, sin decimales inútiles). */
export function formatMedida(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "—";
  return numero.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}
