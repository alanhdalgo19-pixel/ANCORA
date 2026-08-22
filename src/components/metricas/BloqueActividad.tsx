// Bloque 1 del dashboard — actividad reciente (Prompt 10).

import { Euro, FileText, PercentCircle, Wallet } from "lucide-react";
import { formatEuros } from "@/lib/format";
import type { Actividad } from "@/lib/metricas/tipos";
import { TarjetaMetrica } from "./TarjetaMetrica";
import { formatPorcentaje } from "./tecnicas";

interface Props {
  actividad: Actividad;
}

export function BloqueActividad({ actividad }: Props) {
  return (
    <section aria-labelledby="titulo-actividad">
      <h2
        id="titulo-actividad"
        className="text-lg font-semibold text-foreground"
      >
        Actividad del período
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TarjetaMetrica
          etiqueta="Presupuestos emitidos"
          valor={actividad.emitidos.toLocaleString("es-ES")}
          icono={FileText}
          variacionPct={actividad.variacion_emitidos_pct}
          ayuda={`${actividad.emitidos_periodo_anterior.toLocaleString(
            "es-ES",
          )} en el período anterior`}
        />
        <TarjetaMetrica
          etiqueta="Total en cotización"
          valor={formatEuros(actividad.en_cotizacion)}
          icono={Wallet}
          ayuda="Enviados y aceptados aún no volcados a facturación"
        />
        <TarjetaMetrica
          etiqueta="Total aceptado / facturable"
          valor={formatEuros(actividad.total_aceptado)}
          icono={Euro}
          ayuda="Suma de los presupuestos aceptados del período"
        />
        <TarjetaMetrica
          etiqueta="Ratio de conversión"
          valor={formatPorcentaje(actividad.ratio_conversion)}
          icono={PercentCircle}
          ayuda={
            actividad.ratio_conversion === null
              ? "Aún no hay presupuestos resueltos en el período"
              : "Aceptados sobre aceptados + rechazados + caducados"
          }
        />
      </div>
    </section>
  );
}
