import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoPresupuesto } from "@/types/database";

const ETIQUETA: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  caducado: "Caducado",
};

// Fondos suaves y texto de color, en la línea "flat" de CLAUDE.md sección 8.
const ESTILO: Record<EstadoPresupuesto, string> = {
  borrador: "border-border bg-secondary text-muted-foreground",
  enviado: "border-info/30 bg-info/10 text-info",
  aceptado: "border-success/30 bg-success/10 text-success",
  rechazado: "border-danger/30 bg-danger/10 text-danger",
  caducado: "border-warning/30 bg-warning/10 text-warning",
};

export function EstadoBadge({
  estado,
  className,
}: {
  estado: EstadoPresupuesto;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(ESTILO[estado], className)}>
      {ETIQUETA[estado]}
    </Badge>
  );
}

export function etiquetaEstado(estado: EstadoPresupuesto): string {
  return ETIQUETA[estado];
}
