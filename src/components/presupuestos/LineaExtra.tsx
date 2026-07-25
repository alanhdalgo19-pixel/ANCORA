import { CornerDownRight } from "lucide-react";
import { formatEuros } from "@/lib/format";
import type { LineaVista } from "@/types/presupuestos";

/**
 * Representación de una línea de tipo 'extra' (picaje, fotolitos,
 * vectorización, pantones). Se pinta indentada bajo la línea de técnica que la
 * generó para que se lea como lo que es: un cargo asociado a ese trabajo.
 */
export function LineaExtra({ linea }: { linea: LineaVista }) {
  return (
    <span className="flex items-center gap-1.5 pl-5 text-sm text-muted-foreground">
      <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {linea.descripcion}
      <span className="sr-only">, importe {formatEuros(linea.importe_linea)}</span>
    </span>
  );
}
