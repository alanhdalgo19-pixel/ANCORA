import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getUserRole } from "@/lib/supabase/server";
import {
  cargarParametrosWizard,
  cargarPrendas,
  reconstruirDatosLinea,
} from "@/lib/presupuestos/cargar-wizard";
import { LineaWizard } from "@/components/presupuestos/LineaWizard";
import { Button } from "@/components/ui/button";
import type { ColorGrupo } from "@/types/database";

export default async function EditarLineaPage({
  params,
}: {
  params: { id: string; lineaId: string };
}) {
  const supabase = createClient();

  const [{ data: presupuesto }, { data: linea }, rol] = await Promise.all([
    supabase
      .from("presupuestos")
      .select(
        "id, numero, estado, clientes(nombre, tipo_cliente, descuento_bordado_pct)",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("lineas_presupuesto")
      .select(
        "id, presupuesto_id, tipo_linea, cantidad, color, color_grupo, ancho_logo_cm, alto_logo_cm, detalle_calculo",
      )
      .eq("id", params.lineaId)
      .maybeSingle(),
    getUserRole(),
  ]);

  if (!presupuesto || !linea || linea.presupuesto_id !== params.id) notFound();

  if (presupuesto.estado !== "borrador" || rol === "consulta") {
    redirect(`/presupuestos/${params.id}`);
  }

  // La prenda del grupo cuelga de la línea de técnica con `linea_padre_id`.
  const { data: prendaLinea } = await supabase
    .from("lineas_presupuesto")
    .select("prenda_id")
    .eq("linea_padre_id", params.lineaId)
    .eq("tipo_linea", "prenda")
    .maybeSingle();

  const valorInicial = reconstruirDatosLinea({
    cantidad: Number(linea.cantidad),
    prenda_id: (prendaLinea?.prenda_id as string | null) ?? null,
    color: (linea.color as string | null) ?? null,
    color_grupo: (linea.color_grupo as ColorGrupo | null) ?? null,
    ancho_logo_cm:
      linea.ancho_logo_cm === null ? null : Number(linea.ancho_logo_cm),
    alto_logo_cm:
      linea.alto_logo_cm === null ? null : Number(linea.alto_logo_cm),
    detalle_calculo: linea.detalle_calculo,
  });

  if (!valorInicial) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Esta línea no se puede reeditar
        </h1>
        <p className="text-sm text-muted-foreground">
          El detalle del cálculo guardado no tiene el formato que espera el
          wizard. Elimínala desde el presupuesto y vuelve a añadirla.
        </p>
        <Button asChild variant="outline">
          <Link href={`/presupuestos/${params.id}`}>Volver al presupuesto</Link>
        </Button>
      </main>
    );
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
        Number(
          (cliente as { descuento_bordado_pct?: number } | null)
            ?.descuento_bordado_pct,
        ) || 0
      }
      prendas={prendas}
      parametros={parametros}
      lineaId={params.lineaId}
      valorInicial={valorInicial}
    />
  );
}
