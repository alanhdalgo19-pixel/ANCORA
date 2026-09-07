"use client";

// F2.1 — zona de subida de logos con arrastrar y soltar.
//
// Drag & drop con las APIs nativas de HTML5, sin librerías (CLAUDE.md: no
// introducir dependencias nuevas sin justificarlas).
//
// La validación de `@/lib/logos/validar` se ejecuta aquí para que Sonia vea el
// error al instante sin esperar a subir 5 MB; el servidor la repite entera y
// además comprueba la firma del archivo, que es la que de verdad protege.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FORMATOS_LEGIBLES,
  TAMANO_MAX_BYTES,
  validarArchivoLogo,
  type FormatoLogo,
} from "@/lib/logos/validar";
import { subirLogo } from "./actions";

interface SubirLogoProps {
  clienteId: string;
  /** Si el cliente ya tiene alguno, se ofrece marcar el nuevo como principal. */
  tieneLogos: boolean;
}

interface Seleccion {
  archivo: File;
  formato: FormatoLogo;
  /** Object URL para la miniatura; null en PDF, que no se previsualiza. */
  previsualizacion: string | null;
}

/** "Doyle_v3.svg" → "Doyle_v3": el nombre por defecto del logo. */
function nombreSinExtension(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf(".");
  return punto > 0 ? nombreArchivo.slice(0, punto) : nombreArchivo;
}

const ACEPTADOS = ".png,.jpg,.jpeg,.svg,.pdf";
const MAX_MB = (TAMANO_MAX_BYTES / 1024 / 1024).toFixed(0);

export function SubirLogo({ clienteId, tieneLogos }: SubirLogoProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  // Los object URL ocupan memoria hasta que se revocan explícitamente.
  useEffect(() => {
    const url = seleccion?.previsualizacion;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [seleccion]);

  function limpiar() {
    setSeleccion(null);
    setNombre("");
    setNotas("");
    setEsPrincipal(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function elegirArchivo(archivo: File | undefined) {
    if (!archivo) return;

    const validacion = validarArchivoLogo(archivo);
    if (!validacion.valido || !validacion.formato) {
      setError(validacion.error ?? "No se puede usar este archivo.");
      setSeleccion(null);
      return;
    }

    setError(null);
    setSeleccion({
      archivo,
      formato: validacion.formato,
      previsualizacion:
        validacion.formato === "pdf" ? null : URL.createObjectURL(archivo),
    });
    setNombre(nombreSinExtension(archivo.name));
  }

  function alSoltar(evento: React.DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    elegirArchivo(evento.dataTransfer.files?.[0]);
  }

  function enviar() {
    if (!seleccion || enviando) return;

    const datos = new FormData();
    datos.set("cliente_id", clienteId);
    datos.set("archivo", seleccion.archivo);
    datos.set("nombre", nombre.trim() || seleccion.archivo.name);
    datos.set("notas", notas.trim());
    datos.set("es_principal", String(esPrincipal));

    iniciarEnvio(async () => {
      const resultado = await subirLogo(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setError(null);
      limpiar();
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">Subir nuevo logo</h2>

      <div
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        className={`mt-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          arrastrando
            ? "border-ancora-primary bg-ancora-primary-light"
            : "border-border bg-muted/30"
        }`}
      >
        <UploadCloud
          className="mx-auto h-8 w-8 text-muted-foreground"
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
          disabled={enviando}
        >
          o pincha para seleccionar
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {FORMATOS_LEGIBLES} · máx. {MAX_MB} MB
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACEPTADOS}
          className="sr-only"
          aria-label="Seleccionar archivo de logo"
          onChange={(evento) => elegirArchivo(evento.target.files?.[0])}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {seleccion && (
        <div className="mt-4 space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
              {seleccion.previsualizacion ? (
                // eslint-disable-next-line @next/next/no-img-element -- object URL local, next/image no aplica
                <img
                  src={seleccion.previsualizacion}
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
                {seleccion.archivo.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {seleccion.formato.toUpperCase()} ·{" "}
                {(seleccion.archivo.size / 1024).toFixed(0)} KB
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar el archivo seleccionado"
              onClick={limpiar}
              disabled={enviando}
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre-logo">Nombre</Label>
            <Input
              id="nombre-logo"
              value={nombre}
              maxLength={120}
              onChange={(evento) => setNombre(evento.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notas-logo">Notas (opcional)</Label>
            <Textarea
              id="notas-logo"
              value={notas}
              rows={2}
              maxLength={500}
              placeholder="Por ejemplo: versión para prenda oscura"
              onChange={(evento) => setNotas(evento.target.value)}
              disabled={enviando}
            />
          </div>

          {tieneLogos && (
            <div className="flex items-center gap-2">
              <input
                id="principal-logo"
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-ancora-primary"
                checked={esPrincipal}
                onChange={(evento) => setEsPrincipal(evento.target.checked)}
                disabled={enviando}
              />
              <Label htmlFor="principal-logo" className="font-normal">
                Marcar como logo principal del cliente
              </Label>
            </div>
          )}

          {!tieneLogos && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Es el primer logo del cliente: se marcará como principal.
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

          <div className="flex gap-2">
            <Button type="button" onClick={enviar} disabled={enviando}>
              {enviando ? "Subiendo…" : "Subir logo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={limpiar}
              disabled={enviando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
