import { createClient } from "@/lib/supabase/server";
import { CostesOperativosTable } from "@/components/admin/CostesOperativosTable";

export default async function AdminCostesPage() {
  const supabase = createClient();
  const { data: costes } = await supabase
    .from("costes_operativos")
    .select("*")
    .order("clave");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Costes operativos
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Valores globales usados en presupuestos y en el cálculo de tipo de
        cliente. Los que están en blanco están pendientes de definir con
        Espe.
      </p>

      <div className="mt-6">
        {costes?.length ? (
          <CostesOperativosTable costes={costes} />
        ) : (
          <p className="text-sm text-danger">
            No se encontraron costes operativos.
          </p>
        )}
      </div>
    </main>
  );
}
