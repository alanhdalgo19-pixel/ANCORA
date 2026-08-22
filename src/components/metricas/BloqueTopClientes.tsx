// Bloque 2 del dashboard — top clientes (Prompt 10).
//
// Un mismo cliente puede salir en las dos listas; es lo normal y no se filtra.

import { formatEuros } from "@/lib/format";
import type { TopClientes } from "@/lib/metricas/tipos";
import { BarraSimple } from "./BarraSimple";

interface Props {
  top: TopClientes;
}

const COLOR_VOLUMEN = "#0c8aa3";
const COLOR_CANTIDAD = "#086a82";

function Vacio() {
  return (
    <p className="text-sm text-muted-foreground">
      No hay presupuestos en este período.
    </p>
  );
}

export function BloqueTopClientes({ top }: Props) {
  // Las barras son proporcionales al máximo de SU lista, no a un eje común:
  // comparan clientes entre sí, que es la lectura que interesa.
  const maximoVolumen = top.por_volumen[0]?.total ?? 0;
  const maximoCantidad = top.por_cantidad[0]?.num_presupuestos ?? 0;

  return (
    <section aria-labelledby="titulo-top-clientes">
      <h2
        id="titulo-top-clientes"
        className="text-lg font-semibold text-foreground"
      >
        Top clientes
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">
            Por volumen aceptado
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suma del total de sus presupuestos aceptados.
          </p>

          <div className="mt-4 space-y-3">
            {top.por_volumen.length === 0 ? (
              <Vacio />
            ) : (
              top.por_volumen.map((cliente) => (
                <BarraSimple
                  key={cliente.cliente_id}
                  etiqueta={cliente.nombre}
                  valor={formatEuros(cliente.total)}
                  proporcion={
                    maximoVolumen > 0 ? cliente.total / maximoVolumen : 0
                  }
                  color={COLOR_VOLUMEN}
                />
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">
            Por número de presupuestos
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Todos los estados, no solo los aceptados.
          </p>

          <div className="mt-4 space-y-3">
            {top.por_cantidad.length === 0 ? (
              <Vacio />
            ) : (
              top.por_cantidad.map((cliente) => (
                <BarraSimple
                  key={cliente.cliente_id}
                  etiqueta={cliente.nombre}
                  valor={`${cliente.num_presupuestos}`}
                  proporcion={
                    maximoCantidad > 0
                      ? cliente.num_presupuestos / maximoCantidad
                      : 0
                  }
                  color={COLOR_CANTIDAD}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
