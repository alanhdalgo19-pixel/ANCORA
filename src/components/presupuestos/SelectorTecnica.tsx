"use client";

import { Droplets, Flame, Layers, Printer, Scissors } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DESCRIPCION_TECNICA,
  NOMBRE_TECNICA,
} from "@/lib/presupuestos/descripciones";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CodigoTecnica } from "@/types/database";

const ICONO: Record<CodigoTecnica, LucideIcon> = {
  DTF: Printer,
  BORDADO: Scissors,
  SERIGRAFIA: Layers,
  IMPRESION_DIRECTA: Droplets,
  SUBLIMACION: Flame,
};

const ORDEN: CodigoTecnica[] = [
  "DTF",
  "BORDADO",
  "SERIGRAFIA",
  "IMPRESION_DIRECTA",
  "SUBLIMACION",
];

interface SelectorTecnicaProps {
  /** Sublimación se deshabilita mientras no haya tarifa (CLAUDE.md 10.5). */
  sublimacionDisponible: boolean;
  seleccionada: CodigoTecnica | null;
  onSeleccionar: (tecnica: CodigoTecnica) => void;
}

export function SelectorTecnica({
  sublimacionDisponible,
  seleccionada,
  onSeleccionar,
}: SelectorTecnicaProps) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      role="radiogroup"
      aria-label="Técnica de personalización"
    >
      {ORDEN.map((codigo) => {
        const Icono = ICONO[codigo];
        const bloqueada = codigo === "SUBLIMACION" && !sublimacionDisponible;
        const activa = seleccionada === codigo;

        return (
          <button
            key={codigo}
            type="button"
            role="radio"
            aria-checked={activa}
            disabled={bloqueada}
            title={
              bloqueada
                ? "Configura la tarifa en el panel de administración"
                : undefined
            }
            onClick={() => onSeleccionar(codigo)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
              activa
                ? "border-ancora-primary bg-ancora-primary-light"
                : "border-border hover:border-ancora-primary/50 hover:bg-accent/40",
              bloqueada &&
                "cursor-not-allowed border-border bg-muted opacity-60 hover:border-border hover:bg-muted",
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <Icono
                className={cn(
                  "h-5 w-5",
                  activa ? "text-ancora-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              {bloqueada && (
                <Badge
                  variant="outline"
                  className="border-warning/30 bg-warning/10 text-warning"
                >
                  PTE tarifa
                </Badge>
              )}
            </span>
            <span className="text-sm font-medium text-foreground">
              {NOMBRE_TECNICA[codigo]}
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              {bloqueada
                ? "Configura la tarifa en el panel de administración."
                : DESCRIPCION_TECNICA[codigo]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
