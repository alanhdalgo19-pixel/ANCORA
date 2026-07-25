import { notFound, redirect } from "next/navigation";
import { createClient, getUserRole } from "@/lib/supabase/server";
import {
  cargarParametrosWizard,
  cargarPrendas,
} from "@/lib/presupuestos/cargar-wizard";
import { LineaWizard } from "@/components/presupuestos/LineaWizard";

export default async function NuevaLineaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const [{ data: presupuesto }, rol] = await Promise.all([
    supabase
      .from("presupuestos")
      .select("id, numero, estado, clientes(nombre, tipo_cliente, descuento_bordado_pct)")
      .eq("id", params.id)
      .maybeSingle(),
    getUserRole(),
  ]);

  if (!presupuesto) notFound();

  // Un presupuesto emitido es inmutable: no se le añaden líneas.
  if (presupuesto.estado !== "borrador" || rol === "consulta") {
    redirect(`/presupuestos/${params.id}`);
  }

  const cliente = Array.isArray(presupuesto.clientes)
    ? presupuesto.clientes[0]
    : presupuesto.clientes;

  const [prendas, parametros] = await Promise.all([
    cargarPrendas(supabase),
    cargarParametrosWizard(supabase),
  ]);

  return (
    <LineaWizard
      presupuestoId={presupuesto.id as string}
      numeroPresupuesto={presupuesto.numero as string}
      nombreCliente={(cliente as { nombre?: string } | null)?.nombre ?? "—"}
      tipoCliente={
        ((cliente as { tipo_cliente?: string } | null)?.tipo_cliente ??
          "esporadico") as "esporadico" | "habitual"
      }
      descuentoBordadoPct={
        Number((cliente as { descuento_bordado_pct?: number } | null)
          ?.descuento_bordado_pct) || 0
      }
      prendas={prendas}
      parametros={parametros}
    />
  );
}
