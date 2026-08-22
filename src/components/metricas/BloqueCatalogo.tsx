// Bloque 5 del dashboard — estado del catálogo (Prompt 10).
//
// No depende del período: describe cómo está configurado el sistema AHORA.
//
// Los enlaces de configuración solo se pintan para admin. Sonia ve las mismas
// cifras que Espe (transparencia total, decisión A.5 del prompt), pero las
// páginas de `/admin` que arreglan cada aviso son de admin, así que ofrecerle
// un enlace a "Acceso denegado" sería engañarla.

import Link from "next/link";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { EstadoCatalogo } from "@/lib/metricas/tipos";

interface Props {
  catalogo: EstadoCatalogo;
  esAdmin: boolean;
}

interface AvisoProps {
  texto: string;
  enlace?: { href: string; etiqueta: string };
  mostrarEnlace: boolean;
}

function Aviso({ texto, enlace, mostrarEnlace }: AvisoProps) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
      <TriangleAlert
        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
        aria-hidden="true"
      />
      <span>
        {texto}
        {enlace && mostrarEnlace && (
          <>
            {" "}
            <Link href={enlace.href} className="font-medium underline">
              {enlace.etiqueta}
            </Link>
          </>
        )}
      </span>
    </li>
  );
}

export function BloqueCatalogo({ catalogo, esAdmin }: Props) {
  const avisos: AvisoProps[] = [];

  if (catalogo.prendas_sin_precio > 0) {
    avisos.push({
      texto:
        catalogo.prendas_sin_precio === 1
          ? "1 prenda del catálogo no tiene precio cargado."
          : `${catalogo.prendas_sin_precio} prendas del catálogo no tienen precio cargado.`,
      enlace: { href: "/admin/prendas", etiqueta: "Ver prendas" },
      mostrarEnlace: esAdmin,
    });
  }

  if (catalogo.sublimacion_sin_tarifa) {
    avisos.push({
      texto:
        "La tarifa de sublimación aún no está configurada, así que la técnica no se puede presupuestar.",
      enlace: {
        href: "/admin/tarifas/sublimacion",
        etiqueta: "Configurar ahora",
      },
      mostrarEnlace: esAdmin,
    });
  }

  if (catalogo.clientes_sin_datos_fiscales > 0) {
    avisos.push({
      texto:
        catalogo.clientes_sin_datos_fiscales === 1
          ? "1 cliente activo no tiene CIF o dirección, y hará falta para facturar."
          : `${catalogo.clientes_sin_datos_fiscales} clientes activos no tienen CIF o dirección, y harán falta para facturar.`,
      enlace: { href: "/clientes", etiqueta: "Ver clientes" },
      // Los clientes los gestiona también el operador.
      mostrarEnlace: true,
    });
  }

  return (
    <section aria-labelledby="titulo-catalogo">
      <h2 id="titulo-catalogo" className="text-lg font-semibold text-foreground">
        Estado del catálogo
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Configuración pendiente. No depende del período seleccionado.
      </p>

      {avisos.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Catálogo y tarifas completos. No hay nada pendiente de configurar.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {avisos.map((aviso) => (
            <Aviso key={aviso.texto} {...aviso} />
          ))}
        </ul>
      )}
    </section>
  );
}
