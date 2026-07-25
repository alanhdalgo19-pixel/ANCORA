"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { NOMBRE_POSICION } from "@/lib/presupuestos/descripciones";
import { cn } from "@/lib/utils";
import type { Posicion } from "@/types/database";

/** Envoltorio de campo: etiqueta, contenido, ayuda y error inline. */
export function Campo({
  htmlFor,
  label,
  ayuda,
  error,
  className,
  children,
}: {
  htmlFor?: string;
  label: string;
  ayuda?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

const POSICIONES: Posicion[] = ["pecho", "espalda", "manga", "gorra", "otro"];

/** Selector de posición. `soloSerigrafia` limita a pecho/espalda. */
export function SelectorPosicion({
  nombre,
  valor,
  onCambiar,
  soloPechoEspalda = false,
  disabled = false,
}: {
  nombre: string;
  valor: string;
  onCambiar: (valor: Posicion) => void;
  soloPechoEspalda?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Posición">
      {POSICIONES.map((posicion) => {
        const bloqueada =
          soloPechoEspalda && posicion !== "pecho" && posicion !== "espalda";
        const activa = valor === posicion;

        return (
          <button
            key={posicion}
            type="button"
            role="radio"
            name={nombre}
            aria-checked={activa}
            disabled={disabled || bloqueada}
            title={
              bloqueada
                ? "La tarifa de serigrafía solo cubre pecho y espalda"
                : undefined
            }
            onClick={() => onCambiar(posicion)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              activa
                ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                : "border-border text-muted-foreground hover:bg-accent/60",
              bloqueada && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
          >
            {NOMBRE_POSICION[posicion]}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox nativo con etiqueta (sin dependencias nuevas — decisión Prompt 3). */
export function CasillaVerificacion({
  id,
  checked,
  onChange,
  disabled = false,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--ancora-primary)]"
      />
      <span>{children}</span>
    </label>
  );
}

/** Aviso informativo (ámbar) o de error (rojo) dentro de un formulario. */
export function Aviso({
  tono = "info",
  children,
}: {
  tono?: "info" | "warning" | "danger";
  children: ReactNode;
}) {
  const estilos = {
    info: "border-info/25 bg-info/5 text-info",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-danger/30 bg-danger/10 text-danger",
  } as const;

  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm leading-snug",
        estilos[tono],
      )}
      role={tono === "danger" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}

/** Barra de navegación del paso: volver / continuar. */
export function BotonesPaso({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 pt-2">{children}</div>;
}
