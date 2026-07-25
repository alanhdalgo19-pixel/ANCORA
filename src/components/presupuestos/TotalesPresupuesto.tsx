import { formatEuros } from "@/lib/format";

interface TotalesPresupuestoProps {
  subtotal: number;
  descuentoManualPct: number;
  transporte: number;
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

/** Bloque de totales: subtotal → descuento → transporte → IVA → TOTAL. */
export function TotalesPresupuesto({
  subtotal,
  descuentoManualPct,
  transporte,
  ivaPct,
  ivaImporte,
  total,
}: TotalesPresupuestoProps) {
  const descuentoImporte = (subtotal * descuentoManualPct) / 100;
  const base = subtotal - descuentoImporte;

  return (
    <div className="ml-auto w-full max-w-xs">
      <Linea etiqueta="Subtotal" valor={formatEuros(subtotal)} />
      {descuentoManualPct > 0 && (
        <>
          <Linea
            etiqueta={`Descuento (${descuentoManualPct}%)`}
            valor={`− ${formatEuros(descuentoImporte)}`}
            matiz
          />
          <Linea etiqueta="Base imponible" valor={formatEuros(base)} matiz />
        </>
      )}
      {transporte > 0 && (
        <Linea etiqueta="Transporte" valor={formatEuros(transporte)} matiz />
      )}
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
