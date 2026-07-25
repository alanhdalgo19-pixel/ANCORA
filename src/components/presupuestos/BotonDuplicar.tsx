"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { duplicarPresupuesto } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";

/** Botón de duplicar para cada fila del listado. */
export function BotonDuplicar({ presupuestoId }: { presupuestoId: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function duplicar() {
    setOcupado(true);
    const resultado = await duplicarPresupuesto(presupuestoId);
    setOcupado(false);

    if (!resultado.ok) {
      window.alert(resultado.error);
      return;
    }
    router.push(`/presupuestos/${resultado.datos.presupuesto_id}`);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={duplicar}
      disabled={ocupado}
      aria-label="Duplicar presupuesto"
      title="Duplicar presupuesto"
    >
      <Copy className="h-4 w-4" />
      <span className="sr-only">Duplicar</span>
    </Button>
  );
}
