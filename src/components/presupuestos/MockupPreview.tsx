"use client";

// F2.3 — columna derecha del paso 4: el `<Mockup>` de F2.2 en tiempo real.
//
// · Debounce de 200 ms: mientras Sonia teclea "25" no se repinta con "2".
// · Composición DTF: el mockup pinta un logo cada vez y debajo aparece
//   "Ver logo 1 / Ver logo 2 / …" para cambiar cuál (multi-mockup apilado
//   queda para F2.4).
// · Logo en PDF: no se puede pintar dentro del SVG; el mockup dibuja la caja
//   "Sin logo cargado" y debajo se indica el nombre del archivo.

import { useEffect, useMemo, useState } from "react";
import { Mockup } from "@/components/mockup/Mockup";
import type { ColorGrupo } from "@/lib/calculos/types";
import type { TipoPrenda } from "@/lib/mockup/dimensiones-prendas";
import type { LogoMockupSnapshot } from "@/lib/mockup/snapshot";
import { NOMBRE_POSICION } from "@/lib/presupuestos/descripciones";
import { cn } from "@/lib/utils";
import type { LogoWizard } from "@/types/presupuestos";

const MILISEGUNDOS_DEBOUNCE = 200;
const ALTO_MOCKUP_PX = 360;

interface Props {
  tipoPrenda: TipoPrenda;
  colorPrenda: ColorGrupo;
  logo: LogoWizard | null;
  logos: LogoMockupSnapshot[];
}

export function MockupPreview({ tipoPrenda, colorPrenda, logo, logos }: Props) {
  const entrada = useMemo(
    () => ({ tipoPrenda, colorPrenda, logo, logos }),
    [tipoPrenda, colorPrenda, logo, logos],
  );

  const [vista, setVista] = useState(entrada);
  useEffect(() => {
    const temporizador = setTimeout(
      () => setVista(entrada),
      MILISEGUNDOS_DEBOUNCE,
    );
    return () => clearTimeout(temporizador);
  }, [entrada]);

  const [indice, setIndice] = useState(0);
  // Si Sonia quita el logo que se estaba viendo, se vuelve al último que quede.
  const indiceVisible = Math.min(indice, Math.max(0, vista.logos.length - 1));
  const actual = vista.logos[indiceVisible] ?? null;

  const logoPintable = vista.logo?.previsualizable ? vista.logo : null;

  return (
    <section
      aria-labelledby="titulo-mockup"
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <h3 id="titulo-mockup" className="text-sm font-medium text-foreground">
        Vista previa sobre la prenda
      </h3>

      {actual ? (
        <div className="flex justify-center">
          <Mockup
            tipo_prenda={vista.tipoPrenda}
            color_prenda={vista.colorPrenda}
            logo_url={logoPintable?.url ?? null}
            logo_ancho_cm={actual.ancho_cm}
            logo_alto_cm={actual.alto_cm}
            ubicacion={actual.ubicacion}
            alto_pixels={ALTO_MOCKUP_PX}
          />
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Introduce el ancho y el alto del logo para verlo sobre la prenda.
        </p>
      )}

      {vista.logo && !vista.logo.previsualizable && (
        <p className="text-center text-xs text-muted-foreground">
          {vista.logo.nombre} (PDF, no previsualizable)
        </p>
      )}
      {!vista.logo && actual && (
        <p className="text-center text-xs text-muted-foreground">
          Sin logo seleccionado: se muestra solo el hueco.
        </p>
      )}

      {vista.logos.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Logo que se muestra en el mockup"
          className="flex flex-wrap justify-center gap-1.5"
        >
          {vista.logos.map((logo, posicion) => (
            <button
              key={posicion}
              type="button"
              role="radio"
              aria-checked={posicion === indiceVisible}
              onClick={() => setIndice(posicion)}
              title={`${NOMBRE_POSICION[logo.ubicacion]} ${logo.ancho_cm} × ${logo.alto_cm} cm`}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                posicion === indiceVisible
                  ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                  : "border-border text-muted-foreground hover:bg-accent/60",
              )}
            >
              Ver logo {posicion + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
