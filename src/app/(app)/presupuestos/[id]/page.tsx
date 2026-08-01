import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { cargarPresupuestoCompleto } from "@/lib/presupuestos/cargar-presupuesto";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TipoClienteBadge } from "@/components/clientes/TipoClienteBadge";
import { AccionesPresupuesto } from "@/components/presupuestos/AccionesPresupuesto";
import { AjustesPresupuestoForm } from "@/components/presupuestos/AjustesPresupuestoForm";
import { BotonDescargarPDF } from "@/components/presupuestos/BotonDescargarPDF";
import { EstadoBadge } from "@/components/presupuestos/EstadoBadge";
import { PresupuestoPreview } from "@/components/presupuestos/PresupuestoPreview";
import { PreviewModal } from "@/components/presupuestos/PreviewModal";
import { TablaLineasPresupuesto } from "@/components/presupuestos/TablaLineasPresupuesto";
import { TotalesPresupuesto } from "@/components/presupuestos/TotalesPresupuesto";
import { formatFecha } from "@/lib/format";

interface Props {
  params: { id: string };
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{valor}</dd>
    </div>
  );
}

export default async function PresupuestoPage({ params }: Props) {
  const supabase = createClient();
  const [datos, rol] = await Promise.all([
    cargarPresupuestoCompleto(supabase, params.id),
    getUserRole(),
  ]);

  if (!datos) notFound();

  const { presupuesto, cliente, nombreEmisor, lineas } = datos;
  const editable = presupuesto.estado === "borrador" && rol !== "consulta";
  const tieneLineas = lineas.length > 0;

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <Link
          href="/presupuestos"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a presupuestos
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Presupuesto {presupuesto.numero}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={presupuesto.estado} />
              <TipoClienteBadge tipo={cliente.tipo_cliente} />
              {!cliente.activo && (
                <Badge
                  variant="outline"
                  className="border-danger/30 bg-danger/10 text-danger"
                >
                  Cliente inactivo
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button asChild>
                <Link href={`/presupuestos/${presupuesto.id}/linea/nueva`}>
                  <Plus className="h-4 w-4" />
                  Añadir línea
                </Link>
              </Button>
            )}
            <PreviewModal numero={presupuesto.numero}>
              <PresupuestoPreview
                presupuesto={presupuesto}
                cliente={cliente}
                nombreEmisor={nombreEmisor}
                lineas={lineas}
              />
            </PreviewModal>
            {tieneLineas && (
              <BotonDescargarPDF
                presupuestoId={presupuesto.id}
                numero={presupuesto.numero}
                estado={presupuesto.estado}
              />
            )}
            <Button asChild variant="ghost">
              <Link href={`/presupuestos/${presupuesto.id}/preview`}>
                Abrir en pantalla completa
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
        <Dato
          etiqueta="Cliente"
          valor={cliente.nombre}
        />
        <Dato
          etiqueta="Fecha de emisión"
          valor={formatFecha(presupuesto.fecha_emision)}
        />
        <Dato
          etiqueta="Válido hasta"
          valor={formatFecha(presupuesto.fecha_validez)}
        />
        <Dato etiqueta="Creado por" valor={nombreEmisor} />
      </dl>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Líneas</h2>
        <TablaLineasPresupuesto
          presupuestoId={presupuesto.id}
          lineas={lineas}
          editable={editable}
        />
        {tieneLineas && (
          <TotalesPresupuesto
            subtotal={presupuesto.subtotal}
            descuentoManualPct={presupuesto.descuento_manual_pct}
            transporte={presupuesto.transporte}
            baseImponible={presupuesto.base_imponible}
            ivaPct={presupuesto.iva_pct}
            ivaImporte={presupuesto.iva_importe}
            total={presupuesto.total}
          />
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border p-5">
        <h2 className="text-lg font-medium text-foreground">
          Notas, transporte y descuento
        </h2>
        {editable ? (
          <AjustesPresupuestoForm
            presupuestoId={presupuesto.id}
            notas={presupuesto.notas}
            transporte={presupuesto.transporte}
            descuentoManualPct={presupuesto.descuento_manual_pct}
          />
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="whitespace-pre-line">
              {presupuesto.notas || "Sin notas."}
            </p>
            <p>
              El presupuesto ya no es un borrador: los datos son de solo
              lectura. Duplícalo si necesitas partir de él para uno nuevo.
            </p>
          </div>
        )}
      </section>

      {rol !== "consulta" && (
        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="text-lg font-medium text-foreground">Acciones</h2>
          <AccionesPresupuesto
            presupuestoId={presupuesto.id}
            numero={presupuesto.numero}
            estado={presupuesto.estado}
            tieneLineas={tieneLineas}
            rol={rol ?? "consulta"}
          />
        </section>
      )}
    </main>
  );
}
