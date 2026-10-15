// F2.4 — aviso "foto genérica" del mockup.
//
// Solo lo ve un administrador: le recuerda que esa prenda (en ese color) aún
// no tiene foto real y se está pintando el rectángulo abstracto. A Sonia y al
// rol consulta no se les enseña —el fallback es silencioso— y en el PDF nunca
// aparece: el cliente no tiene por qué saber que faltan fotos.

import { ImageOff } from "lucide-react";

export function BadgeFotoGenerica() {
  return (
    <span
      role="note"
      title="Esta prenda no tiene foto real para este color. Súbela en Admin → Prendas → Fotos."
      className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-xs text-warning"
    >
      <ImageOff className="h-3 w-3" aria-hidden="true" />
      foto genérica
    </span>
  );
}
