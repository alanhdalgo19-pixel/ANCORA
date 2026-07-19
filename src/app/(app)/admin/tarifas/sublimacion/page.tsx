import { createClient } from "@/lib/supabase/server";
import { ParametrosSublimacionForm } from "@/components/admin/ParametrosSublimacionForm";

export default async function AdminTarifasSublimacionPage() {
  const supabase = createClient();
  const { data: parametros } = await supabase
    .from("parametros_sublimacion")
    .select("*")
    .eq("id", 1)
    .single();

  const sinConfigurar =
    !parametros?.precio_unitario_base || parametros.precio_unitario_base <= 0;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Sublimación</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Solo disponible sobre prendas blancas de poliéster.
      </p>

      {sinConfigurar && (
        <div className="mt-4 max-w-2xl rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          ⚠️ <strong>PTE TARIFA ESPE</strong> — esta técnica no estará
          disponible en el wizard de presupuestos hasta que se configure.
        </div>
      )}

      <div className="mt-6">
        {parametros ? (
          <ParametrosSublimacionForm parametros={parametros} />
        ) : (
          <p className="text-sm text-danger">
            No se encontraron los parámetros de sublimación. Ejecuta el seed
            de configuración inicial.
          </p>
        )}
      </div>
    </main>
  );
}
