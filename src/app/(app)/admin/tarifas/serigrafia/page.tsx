import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TarifasSerigrafiaTable } from "@/components/admin/TarifasSerigrafiaTable";
import { ParametrosSerigrafiaForm } from "@/components/admin/ParametrosSerigrafiaForm";

export default async function AdminTarifasSerigrafiaPage() {
  const supabase = createClient();

  const [{ data: tarifas }, { data: parametros }] = await Promise.all([
    supabase
      .from("tarifas_serigrafia")
      .select("*")
      .order("ubicacion")
      .order("num_colores")
      .order("desde_cantidad"),
    supabase.from("parametros_serigrafia").select("*").eq("id", 1).single(),
  ]);

  const esporadico = (tarifas ?? []).filter((f) => f.tipo_cliente === "esporadico");
  const habitual = (tarifas ?? []).filter((f) => f.tipo_cliente === "habitual");

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Tarifas de serigrafía
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Precio por unidad según ubicación, número de colores y cantidad.
        Máximo 2 colores soportado actualmente.
      </p>

      <div className="mt-6">
        <Tabs defaultValue="esporadico">
          <TabsList>
            <TabsTrigger value="esporadico">Tarifa esporádico</TabsTrigger>
            <TabsTrigger value="habitual">Tarifa habitual</TabsTrigger>
          </TabsList>
          <TabsContent value="esporadico">
            <TarifasSerigrafiaTable filas={esporadico} />
          </TabsContent>
          <TabsContent value="habitual">
            <TarifasSerigrafiaTable filas={habitual} />
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-foreground">
          Parámetros globales
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recargos, fotolitos, pantones y vectorización — se aplican por
          trabajo, no por tramo.
        </p>
        <div className="mt-4">
          {parametros ? (
            <ParametrosSerigrafiaForm parametros={parametros} />
          ) : (
            <p className="text-sm text-danger">
              No se encontraron los parámetros de serigrafía. Ejecuta el seed
              de configuración inicial.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
