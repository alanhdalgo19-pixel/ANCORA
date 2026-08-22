// Bloque 4 del dashboard — alertas operativas (Prompt 10).
//
// Cada elemento enlaza a la ficha del presupuesto, que es donde se actúa.

import Link from "next/link";
import { ChevronRight, Clock, FileWarning, PencilLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatFecha } from "@/lib/format";
import type { Alertas, PresupuestoAlerta } from "@/lib/metricas/tipos";
import {
  DIAS_BORRADOR_OLVIDADO,
  DIAS_SIN_RESPUESTA,
} from "@/lib/metricas/umbrales";

interface Props {
  alertas: Alertas;
}

interface ListaProps {
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  items: PresupuestoAlerta[];
  /** Cómo se lee la fecha y los días de cada elemento. */
  detalle: (item: PresupuestoAlerta) => string;
  vacio: string;
}

function plural(dias: number): string {
  return dias === 1 ? "1 día" : `${dias} días`;
}

function ListaAlerta({
  titulo,
  descripcion,
  icono: Icono,
  items,
  detalle,
  vacio,
}: ListaProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icono className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
        {items.length > 0 && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            {items.length}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-success">✅ {vacio}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/presupuestos/${item.id}`}
                className="group flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-ancora-primary-dark"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground group-hover:text-ancora-primary-dark">
                    {item.numero}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.cliente} · {detalle(item)}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BloqueAlertas({ alertas }: Props) {
  return (
    <section aria-labelledby="titulo-alertas">
      <h2 id="titulo-alertas" className="text-lg font-semibold text-foreground">
        Alertas operativas
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Los enviados sin respuesta y los borradores olvidados se listan sobre
        todo el histórico, no solo sobre el período: son avisos de seguimiento.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ListaAlerta
          titulo="Sin respuesta"
          descripcion={`Enviados hace más de ${DIAS_SIN_RESPUESTA} días.`}
          icono={Clock}
          items={alertas.sin_respuesta}
          detalle={(item) =>
            `enviado hace ${plural(item.dias)} (${formatFecha(item.fecha)})`
          }
          vacio="Todo al día, no hay presupuestos pendientes de seguimiento."
        />

        <ListaAlerta
          titulo="Caducados en el período"
          descripcion="Presupuestos que pasaron su fecha de validez."
          icono={FileWarning}
          items={alertas.caducados}
          detalle={(item) => `caducó el ${formatFecha(item.fecha)}`}
          vacio="Ningún presupuesto ha caducado en este período."
        />

        <ListaAlerta
          titulo="Borradores olvidados"
          descripcion={`Sin tocar desde hace más de ${DIAS_BORRADOR_OLVIDADO} días.`}
          icono={PencilLine}
          items={alertas.borradores_olvidados}
          detalle={(item) =>
            `creado hace ${plural(item.dias)} (${formatFecha(item.fecha)})`
          }
          vacio="No hay borradores parados."
        />
      </div>
    </section>
  );
}
