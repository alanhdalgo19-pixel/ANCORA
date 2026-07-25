import { createClient } from "@/lib/supabase/server";
import { NuevoPresupuestoForm } from "@/components/presupuestos/NuevoPresupuestoForm";
import type { ClienteOpcion } from "@/components/presupuestos/SelectorCliente";

export default async function NuevoPresupuestoPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("clientes")
    .select(
      "id, nombre, cif, localidad, telefono, email, direccion, tipo_cliente, descuento_bordado_pct",
    )
    .eq("activo", true)
    .order("nombre");

  const clientes: ClienteOpcion[] = (data ?? []).map((cliente) => ({
    id: cliente.id as string,
    nombre: cliente.nombre as string,
    cif: cliente.cif as string | null,
    localidad: cliente.localidad as string | null,
    telefono: cliente.telefono as string | null,
    email: cliente.email as string | null,
    direccion: cliente.direccion as string | null,
    tipo_cliente: cliente.tipo_cliente as ClienteOpcion["tipo_cliente"],
    descuento_bordado_pct: Number(cliente.descuento_bordado_pct) || 0,
  }));

  return <NuevoPresupuestoForm clientes={clientes} />;
}
