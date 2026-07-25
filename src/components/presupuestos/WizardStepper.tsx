import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  /** Nombres de los pasos, en orden. */
  pasos: string[];
  /** Paso actual, empezando en 1. */
  actual: number;
}

/** Indicador de progreso del wizard: "3 de 5 · Detalles". */
export function WizardStepper({ pasos, actual }: WizardStepperProps) {
  return (
    <nav aria-label="Progreso del presupuesto" className="mb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Paso {actual} de {pasos.length}
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        {pasos.map((paso, indice) => {
          const numero = indice + 1;
          const completado = numero < actual;
          const activo = numero === actual;

          return (
            <li key={paso} className="flex items-center gap-2">
              <span
                aria-current={activo ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm",
                  activo && "bg-ancora-primary-light font-medium text-ancora-primary-dark",
                  completado && "text-muted-foreground",
                  !activo && !completado && "text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                    activo && "bg-ancora-primary text-white",
                    completado && "bg-success/15 text-success",
                    !activo && !completado && "border border-border",
                  )}
                >
                  {completado ? <Check className="h-3 w-3" /> : numero}
                </span>
                {paso}
              </span>
              {numero < pasos.length && (
                <span aria-hidden="true" className="text-border">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
