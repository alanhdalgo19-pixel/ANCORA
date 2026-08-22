// Tarjeta de cifra del panel de métricas (Prompt 10).
//
// Componente de presentación puro: recibe el valor ya formateado y no sabe de
// dónde sale. Lo usan tanto el widget de `/admin` como el bloque de actividad
// del dashboard, para que ambos enseñen exactamente la misma cifra con la misma
// forma.

import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  etiqueta: string;
  /** Ya formateado ("12", "1.234,50 €", "N/D"). */
  valor: string;
  icono?: LucideIcon;
  /** Variación porcentual frente al período anterior. null = no se pinta. */
  variacionPct?: number | null;
  /** Aclaración bajo la cifra ("sobre 8 el período anterior"). */
  ayuda?: string;
  /** Compacta la tarjeta: la usa el widget de `/admin`. */
  compacta?: boolean;
}

function Comparativa({ pct }: { pct: number }) {
  const sinCambio = Math.abs(pct) < 0.05;
  const Icono = sinCambio ? Minus : pct > 0 ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        sinCambio
          ? "text-muted-foreground"
          : pct > 0
            ? "text-success"
            : "text-danger",
      )}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {sinCambio
        ? "sin cambios"
        : `${pct > 0 ? "+" : "−"}${Math.abs(pct).toLocaleString("es-ES", {
            maximumFractionDigits: 1,
          })} %`}
    </span>
  );
}

export function TarjetaMetrica({
  etiqueta,
  valor,
  icono: Icono,
  variacionPct = null,
  ayuda,
  compacta = false,
}: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icono && <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />}
        <span>{etiqueta}</span>
      </div>

      <p
        className={cn(
          "mt-2 font-semibold tabular-nums text-foreground",
          compacta ? "text-2xl" : "text-3xl",
        )}
      >
        {valor}
      </p>

      {(variacionPct !== null || ayuda) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {variacionPct !== null && <Comparativa pct={variacionPct} />}
          {ayuda && (
            <span className="text-xs text-muted-foreground">{ayuda}</span>
          )}
        </div>
      )}
    </div>
  );
}
