"use client";

// Filtros y descarga del Excel de exportación (Prompt 9).
//
// El recuento se recalcula con debounce mientras Espe ajusta el rango, para que
// sepa qué está a punto de descargar antes de pulsar el botón.
//
// La descarga NO es un enlace directo al route handler: se hace por `fetch`
// para poder pintar los errores dentro de la pantalla en vez de dejar al
// navegador enseñando un JSON crudo.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previsualizarExportacion } from "@/app/(app)/admin/exportacion/actions";
import {
  LIMITE_PRESUPUESTOS_EXPORTACION,
  type CampoFecha,
  type RecuentoExportacion,
} from "@/lib/exportacion/consultas";

interface Props {
  desdePorDefecto: string;
  hastaPorDefecto: string;
}

const MILISEGUNDOS_DEBOUNCE = 400;

const OPCIONES_CAMPO: { valor: CampoFecha; etiqueta: string }[] = [
  { valor: "fecha_emision", etiqueta: "Fecha de emisión del presupuesto" },
  { valor: "accepted_at", etiqueta: "Fecha de aceptación del presupuesto" },
];

export function FormularioExportacion({
  desdePorDefecto,
  hastaPorDefecto,
}: Props) {
  const router = useRouter();

  const [desde, setDesde] = useState(desdePorDefecto);
  const [hasta, setHasta] = useState(hastaPorDefecto);
  const [campoFecha, setCampoFecha] = useState<CampoFecha>("fecha_emision");

  const [recuento, setRecuento] = useState<RecuentoExportacion | null>(null);
  const [contando, setContando] = useState(false);
  const [errorRecuento, setErrorRecuento] = useState<string | null>(null);

  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const [confirmacionPendiente, setConfirmacionPendiente] = useState(false);
  const [resumenDescarga, setResumenDescarga] = useState<string | null>(null);

  const rangoInvalido = hasta < desde;

  // Cada respuesta lleva su nº de petición: si Espe cambia el rango mientras
  // una consulta está en vuelo, la respuesta vieja no puede pisar a la nueva.
  const peticionActual = useRef(0);

  const contar = useCallback(async () => {
    if (rangoInvalido) {
      setRecuento(null);
      return;
    }

    const identificador = peticionActual.current + 1;
    peticionActual.current = identificador;

    setContando(true);
    const resultado = await previsualizarExportacion({
      desde,
      hasta,
      campo_fecha: campoFecha,
    });

    if (peticionActual.current !== identificador) return;

    setContando(false);
    if (resultado.ok) {
      setRecuento(resultado.datos);
      setErrorRecuento(null);
    } else {
      setRecuento(null);
      setErrorRecuento(resultado.error);
    }
  }, [desde, hasta, campoFecha, rangoInvalido]);

  useEffect(() => {
    const temporizador = setTimeout(contar, MILISEGUNDOS_DEBOUNCE);
    return () => clearTimeout(temporizador);
  }, [contar]);

  // Cualquier cambio de filtro invalida la confirmación y el resumen previos.
  useEffect(() => {
    setConfirmacionPendiente(false);
    setResumenDescarga(null);
    setErrorDescarga(null);
  }, [desde, hasta, campoFecha]);

  const excedeLimite =
    recuento !== null && recuento.total > LIMITE_PRESUPUESTOS_EXPORTACION;

  async function descargar(confirmado: boolean) {
    if (rangoInvalido) return;

    if (excedeLimite && !confirmado) {
      setConfirmacionPendiente(true);
      return;
    }

    setDescargando(true);
    setErrorDescarga(null);
    setResumenDescarga(null);

    try {
      const parametros = new URLSearchParams({
        desde,
        hasta,
        campo_fecha: campoFecha,
      });
      if (confirmado) parametros.set("confirmado", "1");

      const respuesta = await fetch(
        `/api/admin/exportacion/download?${parametros.toString()}`,
      );

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        setErrorDescarga(
          (cuerpo as { error?: string } | null)?.error ??
            "No se ha podido generar el Excel. Inténtalo de nuevo.",
        );
        return;
      }

      const marcados = Number(respuesta.headers.get("X-Ancora-Marcados") ?? 0);
      const total = Number(respuesta.headers.get("X-Ancora-Total") ?? 0);

      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreDesdeCabecera(respuesta) ?? "Ancora_Exportacion.xlsx";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);

      setConfirmacionPendiente(false);
      setResumenDescarga(
        `Excel descargado con ${total} ${total === 1 ? "presupuesto" : "presupuestos"}. ` +
          `${marcados} ${marcados === 1 ? "aceptado marcado" : "aceptados marcados"} como enviados a facturación.`,
      );

      // El recuento de "ya facturados" acaba de cambiar.
      await contar();
      router.refresh();
    } catch (error) {
      console.error("[exportacion] Fallo en la descarga", error);
      setErrorDescarga(
        "No se ha podido conectar con el servidor. Comprueba la conexión e inténtalo de nuevo.",
      );
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input
            id="desde"
            type="date"
            value={desde}
            max={hasta}
            onChange={(evento) => setDesde(evento.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input
            id="hasta"
            type="date"
            value={hasta}
            min={desde}
            onChange={(evento) => setHasta(evento.target.value)}
            aria-invalid={rangoInvalido}
            aria-describedby={rangoInvalido ? "error-rango" : undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campo-fecha">Campo de fecha</Label>
          <select
            id="campo-fecha"
            value={campoFecha}
            onChange={(evento) =>
              setCampoFecha(evento.target.value as CampoFecha)
            }
            aria-describedby="ayuda-campo-fecha"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {OPCIONES_CAMPO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          <p id="ayuda-campo-fecha" className="text-xs text-muted-foreground">
            Filtra los presupuestos según esta fecha.
          </p>
        </div>
      </div>

      {rangoInvalido && (
        <p id="error-rango" className="text-sm text-danger">
          La fecha final no puede ser anterior a la inicial.
        </p>
      )}

      {/* ── Preview del recuento ─────────────────────────────────── */}
      <div
        aria-live="polite"
        className="rounded-lg border border-border bg-muted p-4 text-sm"
      >
        {contando && !recuento && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Calculando…
          </span>
        )}

        {errorRecuento && <span className="text-danger">{errorRecuento}</span>}

        {recuento && !errorRecuento && (
          <div className="space-y-1">
            <p className={contando ? "opacity-60" : undefined}>
              Se exportarán:{" "}
              <strong>{recuento.total_aceptados} aceptados</strong> +{" "}
              {recuento.total_otros} otros ={" "}
              <strong>{recuento.total} presupuestos</strong> totales.
            </p>
            <p className="text-muted-foreground">
              De los aceptados, {recuento.ya_facturados} ya{" "}
              {recuento.ya_facturados === 1 ? "fue enviado" : "fueron enviados"}{" "}
              a facturación anteriormente.
            </p>
          </div>
        )}
      </div>

      {recuento?.total === 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          No hay presupuestos en el rango seleccionado. El Excel estará vacío.
        </div>
      )}

      {/* ── Aviso del flag ───────────────────────────────────────── */}
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
        Solo los presupuestos <strong>ACEPTADOS</strong> de la pestaña
        &quot;Facturables&quot; se marcarán como &quot;enviados a
        facturación&quot; con timestamp. El resto (borradores, rechazados, etc.)
        solo aparecen en la pestaña &quot;Todos&quot; para análisis.
      </div>

      {excedeLimite && confirmacionPendiente && (
        <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          <p>
            El rango tiene <strong>{recuento?.total} presupuestos</strong>, por
            encima del límite recomendado de{" "}
            {LIMITE_PRESUPUESTOS_EXPORTACION}. Generar el archivo puede tardar
            mucho o agotar el tiempo del servidor. ¿Quieres exportarlo
            igualmente?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => descargar(true)}
              disabled={descargando}
            >
              Sí, exportar igualmente
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirmacionPendiente(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => descargar(false)}
          disabled={descargando || rangoInvalido || contando}
        >
          {descargando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {descargando ? "Generando Excel…" : "Descargar Excel"}
        </Button>

        {resumenDescarga && (
          <span className="text-sm text-success" role="status">
            {resumenDescarga}
          </span>
        )}
      </div>

      {errorDescarga && (
        <p className="text-sm text-danger" role="alert">
          {errorDescarga}
        </p>
      )}
    </div>
  );
}

/** Nombre propuesto por el servidor en `Content-Disposition`. */
function nombreDesdeCabecera(respuesta: Response): string | null {
  const cabecera = respuesta.headers.get("Content-Disposition");
  const encontrado = cabecera?.match(/filename="([^"]+)"/);
  return encontrado?.[1] ?? null;
}
