// Dashboard completo de métricas (Prompt 10).
//
// Accesible a admin Y operador: el layout de `/admin` deja pasar a los dos y la
// Server Action lo vuelve a comprobar. Ambos ven exactamente las mismas cifras.
//
// Sin cacheo: las métricas se recalculan en cada carga. Al volumen de Ancora
// (~18 presupuestos al mes) son unas pocas consultas por índice; si algún día
// molestara, el sitio donde añadir caché es la Server Action, no la pantalla.

import { getUserRole } from "@/lib/supabase/server";
import { BloqueActividad } from "@/components/metricas/BloqueActividad";
import { BloqueAlertas } from "@/components/metricas/BloqueAlertas";
import { BloqueCatalogo } from "@/components/metricas/BloqueCatalogo";
import { BloqueDistribucionTecnica } from "@/components/metricas/BloqueDistribucionTecnica";
import { BloqueTopClientes } from "@/components/metricas/BloqueTopClientes";
import {
  ETIQUETAS_PERIODO,
  PERIODO_POR_DEFECTO,
  rangoDePeriodo,
  rangoValido,
  type ClavePeriodo,
  type RangoFechas,
} from "@/lib/metricas/periodos";
import { formatFecha } from "@/lib/format";
import { obtenerMetricas } from "./actions";
import { SelectorPeriodo } from "./SelectorPeriodo";

export const metadata = {
  title: "Métricas · Ancora",
};

interface MetricasPageProps {
  searchParams: {
    periodo?: string;
    desde?: string;
    hasta?: string;
  };
}

const CLAVES: ClavePeriodo[] = [
  "mes_actual",
  "mes_anterior",
  "trimestre",
  "ano",
  "custom",
];

/**
 * Traduce los parámetros de la URL a un período y su rango.
 *
 * Un `custom` con fechas inválidas (o sin ellas) no es un error que merezca una
 * pantalla en rojo: se cae al período por defecto, que es lo que espera alguien
 * que ha manipulado la URL a mano o ha llegado por un enlace viejo.
 */
function resolverPeriodo(searchParams: MetricasPageProps["searchParams"]): {
  periodo: ClavePeriodo;
  rango: RangoFechas;
} {
  const solicitado = CLAVES.find((clave) => clave === searchParams.periodo);

  if (solicitado === "custom") {
    const rango = {
      desde: searchParams.desde ?? "",
      hasta: searchParams.hasta ?? "",
    };
    if (rangoValido(rango)) {
      return { periodo: "custom", rango };
    }
  }

  const periodo =
    solicitado && solicitado !== "custom" ? solicitado : PERIODO_POR_DEFECTO;

  return {
    periodo,
    rango: rangoDePeriodo(periodo as Exclude<ClavePeriodo, "custom">),
  };
}

export default async function MetricasPage({
  searchParams,
}: MetricasPageProps) {
  const { periodo, rango } = resolverPeriodo(searchParams);

  const [rol, resultado] = await Promise.all([
    getUserRole(),
    obtenerMetricas(rango),
  ]);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Métricas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Estado comercial del negocio. Los importes son los del presupuesto
        (IVA incluido), tal y como se enviaron al cliente.
      </p>

      <div className="mt-6 space-y-8">
        <SelectorPeriodo periodo={periodo} rango={rango} />

        {!resultado.ok ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-foreground">
            {resultado.error}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {ETIQUETAS_PERIODO[periodo]}
              </strong>{" "}
              · del {formatFecha(rango.desde)} al {formatFecha(rango.hasta)},
              por fecha de emisión del presupuesto.
            </p>

            <BloqueActividad actividad={resultado.datos.actividad} />
            <BloqueTopClientes top={resultado.datos.top_clientes} />
            <BloqueDistribucionTecnica
              distribucion={resultado.datos.distribucion_tecnica}
            />
            <BloqueAlertas alertas={resultado.datos.alertas} />
            <BloqueCatalogo
              catalogo={resultado.datos.catalogo}
              esAdmin={rol === "admin"}
            />
          </>
        )}
      </div>
    </main>
  );
}
