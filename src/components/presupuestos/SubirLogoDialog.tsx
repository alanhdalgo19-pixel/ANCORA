"use client";

// F2.3 — mini-diálogo "+ Subir" del paso 4 del wizard.
//
// Versión reducida de la zona de subida de la ficha del cliente (F2.1): un
// archivo y un nombre, sin notas ni casilla de "principal" (la subida puntual
// nunca lo marca). Valida en el navegador con `validarArchivoLogo` para que
// Sonia vea el error al instante; el servidor repite la validación entera y
// además comprueba la firma del archivo.

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { subirLogoPuntual } from "@/app/(app)/presupuestos/[id]/linea/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FORMATOS_LEGIBLES,
  TAMANO_MAX_BYTES,
  validarArchivoLogo,
} from "@/lib/logos/validar";
import type { LogoWizard } from "@/types/presupuestos";

const ACEPTADOS = ".png,.jpg,.jpeg,.svg,.pdf";
const MAX_MB = (TAMANO_MAX_BYTES / 1024 / 1024).toFixed(0);

/** "Doyle_v3.svg" → "Doyle_v3": el nombre por defecto del logo. */
function nombreSinExtension(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf(".");
  return punto > 0 ? nombreArchivo.slice(0, punto) : nombreArchivo;
}

interface Props {
  presupuestoId: string;
  abierto: boolean;
  onAbiertoCambia: (abierto: boolean) => void;
  onSubido: (logo: LogoWizard) => void;
}

export function SubirLogoDialog({
  presupuestoId,
  abierto,
  onAbiertoCambia,
  onSubido,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  // Los object URL ocupan memoria hasta que se revocan explícitamente.
  useEffect(() => {
    return () => {
      if (previsualizacion) URL.revokeObjectURL(previsualizacion);
    };
  }, [previsualizacion]);

  function limpiar() {
    setArchivo(null);
    setPrevisualizacion(null);
    setNombre("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function cambiarAbierto(valor: boolean) {
    if (enviando) return;
    if (!valor) limpiar();
    onAbiertoCambia(valor);
  }

  function elegirArchivo(elegido: File | undefined) {
    if (!elegido) return;
    const validacion = validarArchivoLogo(elegido);
    if (!validacion.valido || !validacion.formato) {
      setError(validacion.error ?? "No se puede usar este archivo.");
      setArchivo(null);
      setPrevisualizacion(null);
      return;
    }
    setError(null);
    setArchivo(elegido);
    setPrevisualizacion(
      validacion.formato === "pdf" ? null : URL.createObjectURL(elegido),
    );
    setNombre(nombreSinExtension(elegido.name));
  }

  function enviar() {
    if (!archivo || enviando) return;

    const datos = new FormData();
    datos.set("presupuesto_id", presupuestoId);
    datos.set("archivo", archivo);
    datos.set("nombre", nombre.trim() || archivo.name);

    iniciarEnvio(async () => {
      const resultado = await subirLogoPuntual(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      limpiar();
      onSubido(resultado.datos);
      onAbiertoCambia(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir logo para esta línea</DialogTitle>
          <DialogDescription>
            Se guarda en la biblioteca del cliente y queda seleccionado. No
            cambia su logo principal.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(evento) => {
            evento.preventDefault();
            setArrastrando(false);
            elegirArchivo(evento.dataTransfer.files?.[0]);
          }}
          className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
            arrastrando
              ? "border-ancora-primary bg-ancora-primary-light"
              : "border-border bg-muted/30"
          }`}
        >
          {archivo ? (
            <div className="flex items-center gap-3 text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
                {previsualizacion ? (
                  // eslint-disable-next-line @next/next/no-img-element -- object URL local, next/image no aplica
                  <img
                    src={previsualizacion}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <FileText
                    className="h-6 w-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {archivo.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(archivo.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limpiar}
                disabled={enviando}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <>
              <UploadCloud
                className="mx-auto h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-2 text-sm text-foreground">
                Arrastra un archivo aquí
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => inputRef.current?.click()}
              >
                o pincha para seleccionar
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                {FORMATOS_LEGIBLES} · máx. {MAX_MB} MB
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACEPTADOS}
            className="sr-only"
            aria-label="Seleccionar archivo de logo"
            onChange={(evento) => elegirArchivo(evento.target.files?.[0])}
          />
        </div>

        {archivo && (
          <div className="space-y-1.5">
            <Label htmlFor="nombre-logo-puntual">Nombre</Label>
            <Input
              id="nombre-logo-puntual"
              value={nombre}
              maxLength={120}
              onChange={(evento) => setNombre(evento.target.value)}
              disabled={enviando}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {enviando && (
          <div
            role="progressbar"
            aria-label="Subiendo el logo"
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full w-1/3 animate-barra-indeterminada rounded-full bg-ancora-primary" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => cambiarAbierto(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={enviar} disabled={!archivo || enviando}>
            {enviando ? "Subiendo…" : "Subir y usar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
