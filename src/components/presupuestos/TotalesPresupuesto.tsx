import { formatEuros } from "@/lib/format";

interface TotalesPresupuestoProps {
  subtotal: number;
  descuentoManualPct: number;
  transporte: number;
  baseImponible: number;
  ivaPct: number;
  ivaImporte: number;
  total: number;
}

function Linea({
  etiqueta,
  valor,
  matiz = false,
}: {
  etiqueta: string;
  valor: string;
  matiz?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={matiz ? "text-muted-foreground" : "text-foreground"}>
        {etiqueta}
      </span>
      <span className={matiz ? "text-muted-foreground" : "text-foreground"}>
        {valor}
      </span>
    </div>
  );
}

/**
 * Desglose de totales: subtotal → descuento → transporte → base imponible →
 * IVA → TOTAL.
 *
 * El transporte va ANTES de la base imponible porque forma parte de ella
 * (CLAUDE.md 13.6, corregido en el Prompt 7). La base imponible se pinta
 * siempre, aunque no haya descuento ni transporte, para que el orden de
 * lectura del documento sea el mismo en todos los presupuestos.
 */
export function TotalesPresupuesto({
  subtotal,
  descuentoManualPct,
  transporte,
  baseImponible,
  ivaPct,
  ivaImporte,
  total,
}: TotalesPresupuestoProps) {
  const descuentoImporte = (subtotal * descuentoManualPct) / 100;

  return (
    <div className="ml-auto w-full max-w-xs">
      <Linea etiqueta="Subtotal líneas" valor={formatEuros(subtotal)} />
      {descuentoManualPct > 0 && (
        <Linea
          etiqueta={`Descuento (${descuentoManualPct}%)`}
          valor={`− ${formatEuros(descuentoImporte)}`}
          matiz
        />
      )}
      {transporte > 0 && (
        <Linea etiqueta="Transporte" valor={formatEuros(transporte)} matiz />
      )}
      <div className="border-t border-border">
        <Linea etiqueta="Base imponible" valor={formatEuros(baseImponible)} />
      </div>
      <Linea etiqueta={`IVA (${ivaPct}%)`} valor={formatEuros(ivaImporte)} />
      <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-semibold text-foreground">TOTAL</span>
        <span className="text-lg font-semibold text-ancora-primary">
          {formatEuros(total)}
        </span>
      </div>
    </div>
  );
}
