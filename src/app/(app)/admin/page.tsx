// Landing del panel de administración.
//
// Desde el Prompt 10 la abre también el operador: arriba va el widget de
// métricas del mes en curso, que ven admin y operador con las mismas cifras.
// Los avisos de configuración (márgenes, prendas sin precio, sublimación) solo
// se pintan para admin, porque son suyos y llevan a páginas suyas.

import { createClient, getUserRole } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WidgetResumen } from "@/components/metricas/WidgetResumen";
import { cargarEstadoCatalogo } from "@/lib/metricas/consultas";

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [rol, { data: usuario }, { count: totalClientes }, { count: totalPrendas }] =
    await Promise.all([
      getUserRole(),
      user
        ? supabase.from("usuarios").select("nombre").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("activo", true),
      supabase
        .from("prendas")
        .select("id", { count: "exact", head: true })
        .eq("activo", true),
    ]);

  const esAdmin = rol === "admin";

  // Los avisos de configuración comparten criterio con el bloque 5 del
  // dashboard de métricas: un solo sitio que mantener.
  const catalogo = esAdmin ? await cargarEstadoCatalogo(supabase) : null;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Hola, {usuario?.nombre ?? "admin"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {esAdmin
          ? "Resumen del negocio y avisos pendientes de configuración."
          : "Resumen del negocio del mes en curso."}
      </p>

      <div className="mt-6">
        <WidgetResumen />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clientes activos</CardDescription>
            <CardTitle className="text-3xl">{totalClientes ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prendas activas</CardDescription>
            <CardTitle className="text-3xl">{totalPrendas ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {esAdmin && (
        <div className="mt-6 space-y-3">
          {catalogo?.sublimacion_sin_tarifa && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
              ⚠️ <strong>PTE tarifa de sublimación</strong> — esta técnica no
              estará disponible en presupuestos hasta que se configure en{" "}
              <a href="/admin/tarifas/sublimacion" className="underline">
                Tarifas → Sublimación
              </a>
              .
            </div>
          )}

          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
            ⚠️ <strong>Márgenes DTF provisionales (60/50/40/30)</strong> — es la
            única técnica con margen aplicado; el resto está a 0% porque sus
            tarifas ya son precios de venta. Revísalos en{" "}
            <a href="/admin/margenes" className="underline">
              Márgenes
            </a>
            .
          </div>

          {(catalogo?.prendas_sin_precio ?? 0) > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
              ⚠️{" "}
              <strong>
                {catalogo?.prendas_sin_precio} prendas sin precios de coste
              </strong>{" "}
              — revísalas en{" "}
              <a href="/admin/prendas" className="underline">
                Prendas
              </a>
              .
            </div>
          )}
        </div>
      )}
    </main>
  );
}
