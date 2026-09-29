"use client";

// F2.3 — los formularios del paso 4 avisan al wizard de las medidas que Sonia
// va tecleando, para que el mockup de la columna derecha se redibuje.
//
// Cada formulario conoce sus campos (DTF tiene una lista de logos, bordado uno
// solo, serigrafía unas medidas opcionales…) y los traduce a la forma común
// `LogoMockupSnapshot[]`. Este hook solo se encarga de avisar cuando cambian
// de verdad: react-hook-form devuelve objetos nuevos en cada render, así que se
// compara por contenido serializado para no disparar el efecto sin parar.
//
// El debounce de 200 ms NO vive aquí sino en `MockupPreview`: así el aviso es
// inmediato y el único que espera es el dibujo.

import { useEffect, useRef } from "react";
import type { Ubicacion } from "@/lib/calculos/types";
import type { LogoMockupSnapshot } from "@/lib/mockup/snapshot";

export type AvisoCambioMockup = (logos: LogoMockupSnapshot[]) => void;

/** Medidas tal como llegan de un input: número, NaN, null o undefined. */
interface MedidasEnVivo {
  ubicacion: Ubicacion;
  ancho_cm: number | null | undefined;
  alto_cm: number | null | undefined;
}

function valida(valor: number | null | undefined): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

/** Descarta los logos a medio rellenar: sin ancho y alto no hay qué pintar. */
export function logosPintables(medidas: MedidasEnVivo[]): LogoMockupSnapshot[] {
  return medidas.flatMap((medida) =>
    valida(medida.ancho_cm) && valida(medida.alto_cm)
      ? [
          {
            ubicacion: medida.ubicacion,
            ancho_cm: medida.ancho_cm,
            alto_cm: medida.alto_cm,
            // Rotable = se gira en el rollo, no sobre la prenda (Prompt 8,
            // decisión 3): el mockup pinta siempre la orientación real.
            rotado: false,
          },
        ]
      : [],
  );
}

export function useCambioMockup(
  medidas: MedidasEnVivo[],
  onCambio: AvisoCambioMockup | undefined,
) {
  const clave = JSON.stringify(logosPintables(medidas));
  // La función del padre cambia de identidad en cada render; se guarda en una
  // ref para que no forme parte de las dependencias del efecto.
  const aviso = useRef(onCambio);
  aviso.current = onCambio;

  useEffect(() => {
    aviso.current?.(JSON.parse(clave) as LogoMockupSnapshot[]);
  }, [clave]);
}
