"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  cambiarEstadoPresupuesto,
  duplicarPresupuesto,
  emitirPresupuesto,
} from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import { nombreArchivoPDF } from "@/lib/pdf/nombres";
import type { EstadoPresupuesto, Rol } from "@/types/database";

interface Props {
  presupuestoId: string;
  numero: string;
  estado: EstadoPresupuesto;
  tieneLineas: boolean;
  rol: Rol;
}

export function AccionesPresupuesto({
  presupuestoId,
  numero,
  estado,
  tieneLineas,
  rol,
}: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  // Solo para ofrecer la descarga inmediata tras emitir; el botón permanente
  // de descarga vive en la cabecera de la página.
  const [recienEmitido, setRecienEmitido] = useState(false);

  const esAdmin = rol === "admin";

  async function ejecutar(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    confirmacion?: string,
  ): Promise<boolean> {
    setError(null);
    setMensaje(null);
    setRecienEmitido(false);
    if (confirmacion && !window.confirm(confirmacion)) return false;

    setOcupado(true);
    const resultado = await accion();
    setOcupado(false);

    if (!resultado.ok) {
      setError(resultado.error ?? "No se ha podido completar la acción.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function emitir() {
    const correcto = await ejecutar(
      () => emitirPresupuesto(presupuestoId),
      "Al emitirlo, el presupuesto deja de ser editable. ¿Continuar?",
    );
    if (!correcto) return;

    setMensaje("Presupuesto emitido y archivado.");
    setRecienEmitido(true);
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
      {mensaje && (
        <p className="text-sm text-success">
          {mensaje}
          {recienEmitido && (
            <>
              {" "}
              <Link
                href={`/api/presupuestos/${presupuestoId}/pdf`}
                prefetch={false}
                download={nombreArchivoPDF(numero)}
                className="font-medium underline underline-offset-2"
              >
                Descargar el PDF ahora
              </Link>
            </>
          )}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
