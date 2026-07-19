import { createClient } from "@/lib/supabase/server";
import { ParametrosBordadoForm } from "@/components/admin/ParametrosBordadoForm";

export default async function AdminTarifasBordadoPage() {
  const supabase = createClient();
  const { data: parametros } = await supabase
    .from("parametros_bordado")
    .select("*")
    .eq("id", 1)
    .single();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Parámetros de bordado
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tarifas por puntada y mínimos aplicados al calcular presupuestos de
        bordado.
      </p>

      <div className="mt-6">
        {parametros ? (
          <ParametrosBordadoForm parametros={parametros} />
        ) : (
          <p className="text-sm text-danger">
            No se encontraron los parámetros de bordado. Ejecuta el seed de
            configuración inicial.
          </p>
        )}
      </div>
    </main>
  );
}
