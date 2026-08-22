"use client";

// Selector de período del dashboard de métricas (Prompt 10).
//
// El período vive en la URL (`?periodo=…&desde=…&hasta=…`) y no en el estado de
// React: así la página sigue siendo un Server Component que recalcula en el
// servidor, el rango es enlazable y compartible, y el botón "atrás" del
// navegador funciona como se espera.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ETIQUETAS_PERIODO,
  type ClavePeriodo,
  type RangoFechas,
} from "@/lib/metricas/periodos";

interface Props {
  periodo: ClavePeriodo;
  /** Rango ya resuelto en el servidor; también prellena el modo personalizado. */
  rango: RangoFechas;
}

const ORDEN_PERIODOS: ClavePeriodo[] = [
  "mes_actual",
  "mes_anterior",
  "trimestre",
  "ano",
  "custom",
];

const CLASE_CAMPO =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function SelectorPeriodo({ periodo, rango }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const [desde, setDesde] = useState(rango.desde);
  const [hasta, setHasta] = useState(rango.hasta);

  // Al cambiar de período, los campos personalizados se rellenan con el rango
  // que acaba de resolver el servidor: partir de ahí es lo más cómodo.
  useEffect(() => {
    setDesde(rango.desde);
    setHasta(rango.hasta);
  }, [rango.desde, rango.hasta]);

  const rangoInvalido = hasta < desde;

  function navegar(parametros: URLSearchParams) {
    iniciarTransicion(() => {
      router.push(`/admin/metricas?${parametros.toString()}`);
    });
  }

  function cambiarPeriodo(clave: ClavePeriodo) {
    const parametros = new URLSearchParams({ periodo: clave });
    if (clave === "custom") {
      parametros.set("desde", desde);
      parametros.set("hasta", hasta);
    }
    navegar(parametros);
  }

  function aplicarRango(nuevoDesde: string, nuevoHasta: string) {
    if (!nuevoDesde || !nuevoHasta || nuevoHasta < nuevoDesde) return;
    navegar(
      new URLSearchParams({
        periodo: "custom",
        desde: nuevoDesde,
        hasta: nuevoHasta,
      }),
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="periodo">Período</Label>
          <select
            id="periodo"
            value={periodo}
            onChange={(evento) =>
              cambiarPeriodo(evento.target.value as ClavePeriodo)
            }
            className={CLASE_CAMPO}
          >
            {ORDEN_PERIODOS.map((clave) => (
              <option key={clave} value={clave}>
                {ETIQUETAS_PERIODO[clave]}
              </option>
            ))}
          </select>
        </div>

        {periodo === "custom" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rango-desde">Desde</Label>
              <Input
                id="rango-desde"
                type="date"
                value={desde}
                max={hasta}
                onChange={(evento) => {
                  setDesde(evento.target.value);
                  aplicarRango(evento.target.value, hasta);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rango-hasta">Hasta</Label>
              <Input
                id="rango-hasta"
                type="date"
                value={hasta}
                min={desde}
                onChange={(evento) => {
                  setHasta(evento.target.value);
                  aplicarRango(desde, evento.target.value);
                }}
                aria-invalid={rangoInvalido}
                aria-describedby={rangoInvalido ? "error-rango" : undefined}
              />
            </div>
          </>
        )}

        <div className="flex items-end">
          <p
            aria-live="polite"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            {pendiente ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Recalculando…
              </>
            ) : (
              <span className="tabular-nums">
                {rango.desde} → {rango.hasta}
              </span>
            )}
          </p>
        </div>
      </div>

      {rangoInvalido && (
        <p id="error-rango" className="mt-3 text-sm text-danger">
          La fecha final no puede ser anterior a la inicial.
        </p>
      )}
    </div>
  );
}
