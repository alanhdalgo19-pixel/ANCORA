"use client";

import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
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

const POSICIONES: Posicion[] = ["pecho", "espalda", "manga", "otro"];

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

/**
 * Ancho y alto del logo cuando NO influyen en el precio (serigrafía, impresión
 * directa, sublimación): son opcionales y solo sirven para el mockup (F2.3).
 * Recibe las props del input ya preparadas (`register` de react-hook-form o
 * `value`/`onChange` controlados), así vale para los dos tipos de formulario.
 */
export function CamposMedidasMockup({
  idPrefijo,
  propsAncho,
  propsAlto,
  errorAncho,
  errorAlto,
  disabled = false,
}: {
  idPrefijo: string;
  propsAncho: ComponentProps<typeof Input>;
  propsAlto: ComponentProps<typeof Input>;
  errorAncho?: string;
  errorAlto?: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium leading-none text-foreground">
        Medidas del logo{" "}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </legend>
      <p className="text-xs text-muted-foreground">
        No cambian el precio: solo sirven para ver el logo sobre la prenda en el
        mockup y en el PDF.
      </p>
      <div className="grid max-w-md grid-cols-2 gap-4">
        <Campo htmlFor={`${idPrefijo}-ancho`} label="Ancho (cm)" error={errorAncho}>
          <Input
            id={`${idPrefijo}-ancho`}
            type="number"
            step="0.1"
            min={0}
            inputMode="decimal"
            disabled={disabled}
            {...propsAncho}
          />
        </Campo>
        <Campo htmlFor={`${idPrefijo}-alto`} label="Alto (cm)" error={errorAlto}>
          <Input
            id={`${idPrefijo}-alto`}
            type="number"
            step="0.1"
            min={0}
            inputMode="decimal"
            disabled={disabled}
            {...propsAlto}
          />
        </Campo>
      </div>
    </fieldset>
  );
}

/** Barra de navegación del paso: volver / continuar. */
export function BotonesPaso({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3 pt-2">{children}</div>;
}
