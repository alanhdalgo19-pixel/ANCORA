"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  cambiarEstadoPresupuesto,
  duplicarPresupuesto,
  emitirPresupuesto,
} from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import type { EstadoPresupuesto, Rol } from "@/types/database";

interface Props {
  presupuestoId: string;
  estado: EstadoPresupuesto;
  tieneLineas: boolean;
  rol: Rol;
}

export function AccionesPresupuesto({
  presupuestoId,
  estado,
  tieneLineas,
  rol,
}: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const esAdmin = rol === "admin";

  async function ejecutar(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    confirmacion?: string,
  ) {
    setError(null);
    setMensaje(null);
    if (confirmacion && !window.confirm(confirmacion)) return;

    setOcupado(true);
    const resultado = await accion();
    setOcupado(false);

    if (!resultado.ok) {
      setError(resultado.error ?? "No se ha podido completar la acción.");
      return;
    }
    router.refresh();
  }

  async function emitir() {
    await ejecutar(
      () => emitirPresupuesto(presupuestoId),
      "Al emitirlo, el presupuesto deja de ser editable. ¿Continuar?",
    );
    setMensaje("Presupuesto emitido.");
  }

  async function duplicar() {
    setError(null);
    setOcupado(true);
    const resultado = await duplicarPresupuesto(presupuestoId);
    setOcupado(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.push(`/presupuestos/${resultado.datos.presupuesto_id}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {estado === "borrador" && (
          <Button
            type="button"
            onClick={emitir}
            disabled={ocupado || !tieneLineas}
            title={
              tieneLineas
                ? undefined
                : "Añade al menos una línea antes de emitir"
            }
          >
            <Send className="h-4 w-4" />
            Emitir presupuesto
          </Button>
        )}

        {estado === "enviado" && esAdmin && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() =>
                ejecutar(() =>
                  cambiarEstadoPresupuesto(presupuestoId, "aceptado"),
                )
              }
            >
              <ThumbsUp className="h-4 w-4" />
              Marcar como aceptado
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() =>
                ejecutar(() =>
                  cambiarEstadoPresupuesto(presupuestoId, "rechazado"),
                )
              }
            >
              <ThumbsDown className="h-4 w-4" />
              Marcar como rechazado
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={duplicar}
          disabled={ocupado}
        >
          <Copy className="h-4 w-4" />
          Duplicar
        </Button>
      </div>

      {estado === "enviado" && !esAdmin && (
        <p className="text-xs text-muted-foreground">
          Marcar el presupuesto como aceptado o rechazado lo hace un
          administrador.
        </p>
      )}
      {mensaje && <p className="text-sm text-success">{mensaje}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
