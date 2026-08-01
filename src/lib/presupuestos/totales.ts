// Desglose fiscal de un presupuesto (CLAUDE.md 6.3 y 13.6).
//
// Función pura y sin Supabase, igual que el motor de cálculo de
// `src/lib/calculos/`: es la aritmética que decide el importe que ve el cliente
// en el PDF, así que tiene que poder probarse sola.
//
// El transporte forma parte de la BASE IMPONIBLE. Es una entrega accesoria a la
// principal y tributa al mismo tipo; sumarlo después del IVA (como hacía el
// Prompt 6) lo facturaba como importe exento. Corregido en el Prompt 7.

import { redondear2 } from "@/lib/calculos";

export interface EntradaTotales {
  /** Suma bruta de los importes de línea, sin descuento y sin transporte. */
  subtotal: number;
  /** Descuento manual sobre el subtotal, en porcentaje. */
  descuentoPct: number;
  /** Portes, en euros. Entran en la base imponible. */
  transporte: number;
  /** Tipo de IVA aplicable, en porcentaje. */
  ivaPct: number;
}

export interface TotalesPresupuesto {
  subtotal: number;
  descuentoImporte: number;
  transporte: number;
  baseImponible: number;
  ivaImporte: number;
  total: number;
}

export function calcularTotalesPresupuesto({
  subtotal,
  descuentoPct,
  transporte,
  ivaPct,
}: EntradaTotales): TotalesPresupuesto {
  const subtotalRedondeado = redondear2(subtotal);
  const descuentoImporte = redondear2(
    (subtotalRedondeado * descuentoPct) / 100,
  );
  const baseImponible = redondear2(
    subtotalRedondeado - descuentoImporte + transporte,
  );
  const ivaImporte = redondear2((baseImponible * ivaPct) / 100);

  return {
    subtotal: subtotalRedondeado,
    descuentoImporte,
    transporte: redondear2(transporte),
    baseImponible,
    ivaImporte,
    total: redondear2(baseImponible + ivaImporte),
  };
}
