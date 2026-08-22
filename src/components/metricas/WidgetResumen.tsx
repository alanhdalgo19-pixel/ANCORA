// Widget resumen de la landing de `/admin` (Prompt 10).
//
// Server Component asíncrono: se carga sus propios datos a través de la Server
// Action, que es también donde vive el control de rol. Si el usuario no es
// admin ni operador la acción devuelve error y el widget no pinta nada, sin
// romper el resto de la página.

import Link from "next/link";
import { ArrowRight, Euro, FileText, PercentCircle, Wallet } from "lucide-react";
import { obtenerActividadMesActual } from "@/app/(app)/admin/metricas/actions";
import { formatEuros } from "@/lib/format";
import { TarjetaMetrica } from "./TarjetaMetrica";
import { formatPorcentaje } from "./tecnicas";

const MES_LARGO = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export async function WidgetResumen() {
  const resultado = await obtenerActividadMesActual();

  if (!resultado.ok) return null;

  const { actividad, rango } = resultado.datos;
  const mes = MES_LARGO.format(new Date(`${rango.desde}T00:00:00Z`));

  return (
    <section aria-labelledby="titulo-widget-metricas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="titulo-widget-metricas"
          className="text-lg font-semibold text-foreground"
        >
          Resumen de {mes}
        </h2>
        <Link
          href="/admin/metricas"
          className="inline-flex items-center gap-1 text-sm font-medium text-ancora-primary hover:text-ancora-primary-dark hover:underline"
        >
          Ver métricas completas
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaMetrica
          compacta
          etiqueta="Emitidos este mes"
          valor={actividad.emitidos.toLocaleString("es-ES")}
          icono={FileText}
          variacionPct={actividad.variacion_emitidos_pct}
        />
        <TarjetaMetrica
          compacta
          etiqueta="En cotización"
          valor={formatEuros(actividad.en_cotizacion)}
          icono={Wallet}
        />
        <TarjetaMetrica
          compacta
          etiqueta="Aceptado este mes"
          valor={formatEuros(actividad.total_aceptado)}
          icono={Euro}
        />
        <TarjetaMetrica
          compacta
          etiqueta="Ratio de conversión"
          valor={formatPorcentaje(actividad.ratio_conversion)}
          icono={PercentCircle}
        />
      </div>
    </section>
  );
}
