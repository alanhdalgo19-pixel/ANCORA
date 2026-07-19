import { createClient } from "@/lib/supabase/server";
import { TiposPicajeTable } from "@/components/admin/TiposPicajeTable";

const ORDEN: Record<string, number> = {
  SENCILLO: 0,
  MEDIO: 1,
  COMPLEJO: 2,
  PERSONALIZADO: 3,
};

export default async function AdminTarifasPicajePage() {
  const supabase = createClient();
  const { data: tipos } = await supabase.from("tipos_picaje").select("*");

  const ordenados = [...(tipos ?? [])].sort(
    (a, b) => (ORDEN[a.codigo] ?? 99) - (ORDEN[b.codigo] ?? 99),
  );

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Tipos de picaje
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Se cobran como línea independiente en los presupuestos de bordado. El
        tipo &quot;Personalizado&quot; permite un precio libre en el wizard.
      </p>

      <div className="mt-6">
        {ordenados.length ? (
          <TiposPicajeTable tipos={ordenados} />
        ) : (
          <p className="text-sm text-danger">
            No se encontraron tipos de picaje.
          </p>
        )}
      </div>
    </main>
  );
}
