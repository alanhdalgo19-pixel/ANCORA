import { createClient } from "@/lib/supabase/server";
import { PrendaForm } from "@/components/admin/PrendaForm";

export default async function NuevaPrendaPage() {
  const supabase = createClient();
  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Nueva prenda</h1>
      <div className="mt-6">
        <PrendaForm proveedores={proveedores ?? []} />
      </div>
    </main>
  );
}
