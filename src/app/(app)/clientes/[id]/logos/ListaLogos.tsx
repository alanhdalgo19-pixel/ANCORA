// F2.1 — biblioteca de logos guardados de un cliente.
//
// Server Component: recibe las filas ya cargadas y solo pinta. Lo interactivo
// (renombrar, marcar principal, confirmar borrado) vive en `AccionesLogo.tsx`.
//
// Las miniaturas apuntan a `/api/logos/{id}`, que redirige a una URL firmada
// del bucket privado. El SVG se muestra con `<img>` y no en línea: así el
// navegador no ejecuta nada de lo que traiga el archivo del cliente.

import { FileText, Star } from "lucide-react";
import { formatFecha, formatTamanoArchivo } from "@/lib/format";
import type { LogoCliente } from "@/types/database";
import { AccionesLogo } from "./AccionesLogo";

interface ListaLogosProps {
  logos: LogoCliente[];
  /** admin y operador pueden renombrar y marcar principal; consulta solo mira. */
  puedeEscribir: boolean;
  /** Solo admin puede eliminar. */
  esAdmin: boolean;
}

function Miniatura({ logo }: { logo: LogoCliente }) {
  if (logo.formato === "pdf") {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
        <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, next/image no puede optimizarla */}
      <img
        src={`/api/logos/${logo.id}`}
        alt={`Logo ${logo.nombre}`}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function ListaLogos({
  logos,
  puedeEscribir,
  esAdmin,
}: ListaLogosProps) {
  if (logos.length === 0) {
    return (
      <section className="rounded-lg border border-border p-6 text-center">
        <h2 className="text-sm font-semibold text-foreground">Biblioteca</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este cliente aún no tiene logos guardados.
          {puedeEscribir && " Sube el primero arrastrándolo arriba."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Biblioteca ({logos.length} {logos.length === 1 ? "logo" : "logos"})
      </h2>

      <ul className="mt-3 divide-y divide-border">
        {logos.map((logo) => (
          <li key={logo.id} className="flex gap-3 py-4 first:pt-2 last:pb-1">
            <Miniatura logo={logo} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {logo.es_principal && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-ancora-primary-light px-2 py-0.5 text-xs font-semibold text-ancora-primary-dark">
                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                    Logo principal
                  </span>
                )}
                <span className="truncate text-sm font-medium text-foreground">
                  {logo.nombre}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {logo.formato.toUpperCase()} ·{" "}
                {formatTamanoArchivo(logo.tamano_bytes)}
                {logo.ancho_px && logo.alto_px
                  ? ` · ${logo.ancho_px}×${logo.alto_px} px`
                  : ""}{" "}
                · subido {formatFecha(logo.subido_at)}
              </p>

              {logo.notas && (
                <p className="mt-1 text-xs text-muted-foreground">{logo.notas}</p>
              )}

              {puedeEscribir && (
                <AccionesLogo
                  logoId={logo.id}
                  nombre={logo.nombre}
                  esPrincipal={logo.es_principal}
                  esAdmin={esAdmin}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
