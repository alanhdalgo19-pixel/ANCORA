// Bloque 3 del dashboard — distribución por técnica (Prompt 10).

import { formatEuros } from "@/lib/format";
import { CODIGOS_TECNICA } from "@/lib/metricas/calcularMetricas";
import type { DistribucionTecnica } from "@/lib/metricas/tipos";
import { BarraSimple } from "./BarraSimple";
import { COLOR_TECNICA, ETIQUETA_TECNICA } from "./tecnicas";

interface Props {
  distribucion: DistribucionTecnica;
}

export function BloqueDistribucionTecnica({ distribucion }: Props) {
  const { por_num_presupuestos, por_facturacion, total_presupuestos_con_tecnica } =
    distribucion;

  const maximoImporte = Math.max(
    0,
    ...CODIGOS_TECNICA.map((codigo) => por_facturacion[codigo]),
  );

  const hayTecnicas = total_presupuestos_con_tecnica > 0;
  const hayImportes = maximoImporte > 0;

  return (
    <section aria-labelledby="titulo-distribucion">
      <h2
        id="titulo-distribucion"
        className="text-lg font-semibold text-foreground"
      >
        Distribución por técnica
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">
            Presencia en presupuestos
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Un presupuesto cuenta una vez por cada técnica que lleva, sin
            ponderar por el número de líneas.
          </p>

          <div className="mt-4 space-y-3">
            {!hayTecnicas ? (
              <p className="text-sm text-muted-foreground">
                No hay presupuestos con técnica en este período.
              </p>
            ) : (
              CODIGOS_TECNICA.map((codigo) => {
                const cuantos = por_num_presupuestos[codigo];
                const porcentaje =
                  (cuantos / total_presupuestos_con_tecnica) * 100;

                return (
                  <BarraSimple
                    key={codigo}
                    etiqueta={ETIQUETA_TECNICA[codigo]}
                    valor={`${porcentaje.toLocaleString("es-ES", {
                      maximumFractionDigits: 0,
                    })} %`}
                    proporcion={cuantos / total_presupuestos_con_tecnica}
                    color={COLOR_TECNICA[codigo]}
                    detalle={`${cuantos} de ${total_presupuestos_con_tecnica} presupuestos`}
                  />
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">
            Importe aceptado por técnica
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Solo presupuestos aceptados. Los extras (picaje, fotolitos,
            vectorización, pantones) suman a la técnica de su línea.
          </p>

          <div className="mt-4 space-y-3">
            {!hayImportes ? (
              <p className="text-sm text-muted-foreground">
                No hay presupuestos aceptados en este período.
              </p>
            ) : (
              CODIGOS_TECNICA.map((codigo) => (
                <BarraSimple
                  key={codigo}
                  etiqueta={ETIQUETA_TECNICA[codigo]}
                  valor={formatEuros(por_facturacion[codigo])}
                  proporcion={por_facturacion[codigo] / maximoImporte}
                  color={COLOR_TECNICA[codigo]}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
