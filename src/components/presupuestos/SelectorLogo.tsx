"use client";

// F2.3 — bloque "Logo del diseño" del paso 4 del wizard.
//
// Lista la biblioteca del cliente como radio group (el principal primero y
// marcado con ★) y ofrece "+ Subir" para un logo puntual. El logo elegido es el
// que se pinta en el mockup y el que se guarda en el snapshot de la línea.

import { useState } from "react";
import { FileText, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LogoWizard } from "@/types/presupuestos";
import { SubirLogoDialog } from "./SubirLogoDialog";

interface Props {
  presupuestoId: string;
  logos: LogoWizard[];
  logoId: string | null;
  onSeleccionar: (logoId: string | null) => void;
  onSubido: (logo: LogoWizard) => void;
  disabled?: boolean;
}

export function SelectorLogo({
  presupuestoId,
  logos,
  logoId,
  onSeleccionar,
  onSubido,
  disabled = false,
}: Props) {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  return (
    <section
      aria-labelledby="titulo-logo-diseno"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="titulo-logo-diseno" className="text-sm font-medium text-foreground">
          Logo del diseño
          <span className="ml-1.5 font-normal text-muted-foreground">
            · biblioteca del cliente ({logos.length}{" "}
            {logos.length === 1 ? "logo" : "logos"})
          </span>
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setDialogoAbierto(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Subir
        </Button>
      </div>

      {logos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este cliente aún no tiene logos. Sube uno para verlo sobre la prenda.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby="titulo-logo-diseno"
          className="space-y-1"
        >
          {logos.map((logo) => (
            <OpcionLogo
              key={logo.id}
              logo={logo}
              seleccionado={logoId === logo.id}
              disabled={disabled}
              onSeleccionar={() => onSeleccionar(logo.id)}
            />
          ))}
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm",
              logoId === null ? "bg-muted" : "hover:bg-muted/60",
            )}
          >
            <input
              type="radio"
              name="logo-diseno"
              checked={logoId === null}
              disabled={disabled}
              onChange={() => onSeleccionar(null)}
              className="h-4 w-4 accent-[var(--ancora-primary)]"
            />
            <span className="text-muted-foreground">Sin logo</span>
          </label>
        </div>
      )}

      <SubirLogoDialog
        presupuestoId={presupuestoId}
        abierto={dialogoAbierto}
        onAbiertoCambia={setDialogoAbierto}
        onSubido={onSubido}
      />
    </section>
  );
}

function OpcionLogo({
  logo,
  seleccionado,
  disabled,
  onSeleccionar,
}: {
  logo: LogoWizard;
  seleccionado: boolean;
  disabled: boolean;
  onSeleccionar: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm",
        seleccionado ? "bg-ancora-primary-light" : "hover:bg-muted/60",
      )}
    >
      <input
        type="radio"
        name="logo-diseno"
        checked={seleccionado}
        disabled={disabled}
        onChange={onSeleccionar}
        className="h-4 w-4 accent-[var(--ancora-primary)]"
      />
      <span className="flex h-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-white">
        {logo.previsualizable ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, next/image no puede optimizarla
          <img
            src={logo.url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {logo.nombre}
        {logo.es_principal && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            (principal)
            <Star className="h-3 w-3 fill-warning text-warning" aria-hidden="true" />
          </span>
        )}
        {!logo.previsualizable && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            (PDF, no previsualizable)
          </span>
        )}
      </span>
    </label>
  );
}
