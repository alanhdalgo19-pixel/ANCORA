import { createClient } from "@/lib/supabase/server";
import { ParametrosDtfForm } from "@/components/admin/ParametrosDtfForm";

export default async function AdminTarifasDtfPage() {
  const supabase = createClient();
  const { data: parametros } = await supabase
    .from("parametros_dtf")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Parámetros DTF
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Valores globales usados en el cálculo de presupuestos con DTF.
      </p>

      <div className="mt-6">
        {parametros ? (
          <ParametrosDtfForm parametros={parametros} />
        ) : (
          <p className="text-sm text-danger">
            No se encontraron los parámetros de DTF. Ejecuta el seed de
            configuración inicial.
          </p>
        )}
      </div>
    </main>
  );
}
