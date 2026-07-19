import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TramosMargenTable } from "@/components/admin/TramosMargenTable";

const ORDEN: Record<string, number> = {
  DTF: 0,
  BORDADO: 1,
  SERIGRAFIA: 2,
  IMPRESION_DIRECTA: 3,
  SUBLIMACION: 4,
};

export default async function AdminMargenesPage() {
  const supabase = createClient();

  const [{ data: tecnicas }, { data: tramos }] = await Promise.all([
    supabase.from("tecnicas").select("*"),
    supabase.from("tramos_margen").select("*").order("desde_cantidad"),
  ]);

  const tecnicasOrdenadas = [...(tecnicas ?? [])].sort(
    (a, b) => (ORDEN[a.codigo] ?? 99) - (ORDEN[b.codigo] ?? 99),
  );

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Márgenes por tramo de cantidad
      </h1>

      <div className="mt-4 max-w-2xl rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
        ⚠️ Los márgenes cargados inicialmente son provisionales del sector.
        Confirmar con Espe antes de usar en presupuestos reales que se envíen
        a clientes.
      </div>

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        El margen aplica igual a clientes esporádicos y habituales — el
        descuento de cliente habitual se gestiona aparte.
      </p>

      <div className="mt-6">
        {tecnicasOrdenadas.length ? (
          <Tabs defaultValue={tecnicasOrdenadas[0].codigo}>
            <TabsList>
              {tecnicasOrdenadas.map((tecnica) => (
                <TabsTrigger key={tecnica.id} value={tecnica.codigo}>
                  {tecnica.nombre}
                </TabsTrigger>
              ))}
            </TabsList>
            {tecnicasOrdenadas.map((tecnica) => (
              <TabsContent key={tecnica.id} value={tecnica.codigo}>
                <TramosMargenTable
                  filas={(tramos ?? []).filter((t) => t.tecnica_id === tecnica.id)}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="text-sm text-danger">No se encontraron técnicas.</p>
        )}
      </div>
    </main>
  );
}
