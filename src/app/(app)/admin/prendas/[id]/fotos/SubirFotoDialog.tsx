"use client";

// F2.4 — acciones de una tarjeta de color (blanco / color / oscuro):
// "+ Subir" si el hueco está vacío; "Reemplazar" y "Eliminar" si ya hay foto.
//
// Sin modal, igual que el resto del panel (Prompt 9, decisión 9): el botón
// abre el selector de archivos nativo, la foto se valida en el navegador para
// dar el error al instante y se sube en cuanto se elige. El borrado pide
// confirmación en línea.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FORMATOS_FOTO_LEGIBLES,
  TAMANO_MAX_FOTO_BYTES,
  validarArchivoFoto,
} from "@/lib/prendas-fotos/validar";
import type { ColorGrupo } from "@/types/database";
import {
  eliminarFotoPrenda,
  reemplazarFotoPrenda,
  subirFotoPrenda,
  type ResultadoAccionFoto,
} from "./actions";

interface Props {
  prendaId: string;
  colorGrupo: ColorGrupo;
  etiquetaColor: string;
  /** Foto actual del hueco, o null si está vacío. */
  fotoId: string | null;
}

const ACEPTADOS = ".png,.jpg,.jpeg,.webp";
const MAX_MB = (TAMANO_MAX_FOTO_BYTES / 1024 / 1024).toFixed(0);

export function SubirFotoDialog({ prendaId, colorGrupo, etiquetaColor, fotoId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [ocupado, iniciar] = useTransition();

  function ejecutar(accion: () => Promise<ResultadoAccionFoto>) {
    iniciar(async () => {
      const resultado = await accion();
      if (inputRef.current) inputRef.current.value = "";
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setError(null);
      setConfirmarBorrado(false);
      router.refresh();
    });
  }

  function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    const validacion = validarArchivoFoto(archivo);
    if (!validacion.valido) {
      setError(validacion.error ?? "No se puede usar este archivo.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const datos = new FormData();
    datos.set("archivo", archivo);
    if (fotoId) {
      datos.set("foto_id", fotoId);
      ejecutar(() => reemplazarFotoPrenda(datos));
    } else {
      datos.set("prenda_id", prendaId);
      datos.set("color_grupo", colorGrupo);
      ejecutar(() => subirFotoPrenda(datos));
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACEPTADOS}
        className="sr-only"
        aria-label={`Elegir foto para ${etiquetaColor.toLowerCase()}`}
        onChange={(evento) => alElegir(evento.target.files?.[0])}
      />

      {confirmarBorrado && fotoId ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground">¿Eliminar esta foto?</span>
          <Button
            size="sm"
            variant="destructive"
            disabled={ocupado}
            onClick={() => ejecutar(() => eliminarFotoPrenda(fotoId))}
          >
            Sí, eliminar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            onClick={() => setConfirmarBorrado(false)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={fotoId ? "outline" : "default"}
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
          >
            {ocupado ? "Guardando…" : fotoId ? "Reemplazar" : "+ Subir"}
          </Button>
          {fotoId && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={ocupado}
              onClick={() => setConfirmarBorrado(true)}
            >
              Eliminar
            </Button>
          )}
        </div>
      )}

      {ocupado && (
        <div
          role="progressbar"
          aria-label="Guardando la foto"
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full w-1/3 animate-barra-indeterminada rounded-full bg-ancora-primary" />
        </div>
      )}

      {!fotoId && (
        <p className="text-xs text-muted-foreground">
          {FORMATOS_FOTO_LEGIBLES} · máx. {MAX_MB} MB
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
