// Etiquetas y colores de las técnicas en el panel de métricas (Prompt 10).
//
// Los colores van en hexadecimal y no como clases de Tailwind porque las barras
// los aplican por `style`: Tailwind no genera clases construidas en tiempo de
// ejecución. El cyan es el corporativo de CLAUDE.md sección 8; el resto se
// eligen para que las cinco barras se distingan de un vistazo.

import type { CodigoTecnica } from "@/types/database";

export const ETIQUETA_TECNICA: Record<CodigoTecnica, string> = {
  DTF: "DTF",
  BORDADO: "Bordado",
  SERIGRAFIA: "Serigrafía",
  IMPRESION_DIRECTA: "Impresión directa",
  SUBLIMACION: "Sublimación",
};

export const COLOR_TECNICA: Record<CodigoTecnica, string> = {
  DTF: "#0c8aa3",
  BORDADO: "#b68900",
  SERIGRAFIA: "#2e7d32",
  IMPRESION_DIRECTA: "#7c3aed",
  SUBLIMACION: "#db2777",
};

/** "30 %" / "N/D" — el porcentaje se pinta con un decimal como mucho. */
export function formatPorcentaje(valor: number | null): string {
  if (valor === null) return "N/D";
  return `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
}
