"use client";

// F2.1 — botones de cada fila de la biblioteca de logos.
//
// Vive aparte de `ListaLogos.tsx` para que la lista siga siendo un Server
// Component: aquí solo está lo que necesita estado en el navegador —el campo
// de renombrar y la confirmación de borrado en línea.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  eliminarLogo,
  marcarComoPrincipal,
  renombrarLogo,
} from "./actions";

interface AccionesLogoProps {
  logoId: string;
  nombre: string;
  esPrincipal: boolean;
  /** Solo un administrador puede eliminar logos. */
  esAdmin: boolean;
}

type Modo = "acciones" | "renombrar" | "confirmar-borrado";

export function AccionesLogo({
  logoId,
  nombre,
  esPrincipal,
  esAdmin,
}: AccionesLogoProps) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("acciones");
  const [nuevoNombre, setNuevoNombre] = useState(nombre);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setError(null);
      setModo("acciones");
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      {modo === "renombrar" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={nuevoNombre}
            maxLength={120}
            aria-label={`Nuevo nombre para ${nombre}`}
            className="h-8 max-w-xs"
            onChange={(evento) => setNuevoNombre(evento.target.value)}
            disabled={ocupado}
          />
          <Button
            size="sm"
            disabled={ocupado || !nuevoNombre.trim()}
            onClick={() => ejecutar(() => renombrarLogo(logoId, nuevoNombre))}
          >
            Guardar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            onClick={() => {
              setNuevoNombre(nombre);
              setError(null);
              setModo("acciones");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {modo === "confirmar-borrado" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground">
            ¿Seguro que quieres eliminar «{nombre}»?
          </span>
          <Button
            size="sm"
            variant="destructive"
            disabled={ocupado}
            onClick={() => ejecutar(() => eliminarLogo(logoId))}
          >
            Sí, eliminar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={ocupado}
            onClick={() => {
              setError(null);
              setModo("acciones");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {modo === "acciones" && (
        <div className="flex flex-wrap gap-2">
          {!esPrincipal && (
            <Button
              size="sm"
              variant="secondary"
              disabled={ocupado}
              onClick={() => ejecutar(() => marcarComoPrincipal(logoId))}
            >
              Marcar principal
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado}
            onClick={() => setModo("renombrar")}
          >
            Renombrar
          </Button>
          {esAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={ocupado}
              onClick={() => setModo("confirmar-borrado")}
            >
              Eliminar
            </Button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
