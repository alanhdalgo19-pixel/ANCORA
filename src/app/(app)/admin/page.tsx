import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function inicioYFinDelMes() {
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
  };
}

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const { inicio, fin } = inicioYFinDelMes();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: usuario },
    { count: totalClientes },
    { count: totalPrendas },
    { count: presupuestosMes },
    { data: sublimacion },
    { data: preciosPrenda },
  ] = await Promise.all([
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
    supabase
      .from("presupuestos")
      .select("id", { count: "exact", head: true })
      .gte("fecha_emision", inicio)
      .lt("fecha_emision", fin),
    supabase
      .from("parametros_sublimacion")
      .select("precio_unitario_base")
      .eq("id", 1)
      .single(),
    supabase.from("precios_prenda").select("prenda_id, precio"),
  ]);

  const sublimacionSinConfigurar =
    !sublimacion?.precio_unitario_base || sublimacion.precio_unitario_base <= 0;

  const maximoPrecioPorPrenda = new Map<string, number>();
  for (const fila of preciosPrenda ?? []) {
    const actual = maximoPrecioPorPrenda.get(fila.prenda_id);
    if (actual === undefined || fila.precio > actual) {
      maximoPrecioPorPrenda.set(fila.prenda_id, fila.precio);
    }
  }
  const prendasSinPrecios = Array.from(maximoPrecioPorPrenda.values()).filter(
    (maximo) => maximo <= 0,
  ).length;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Hola, {usuario?.nombre ?? "admin"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Resumen del sistema y avisos pendientes de configuración.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Presupuestos este mes</CardDescription>
            <CardTitle className="text-3xl">{presupuestosMes ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-6 space-y-3">
        {sublimacionSinConfigurar && (
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

        {prendasSinPrecios > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
            ⚠️ <strong>{prendasSinPrecios} prendas sin precios de coste</strong>{" "}
            — revísalas en{" "}
            <a href="/admin/prendas" className="underline">
              Prendas
            </a>
            .
          </div>
        )}
      </div>
    </main>
  );
}
