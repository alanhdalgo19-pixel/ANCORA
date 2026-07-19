import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PreciosPrendaMatrix } from "@/components/admin/PreciosPrendaMatrix";
import { desactivarPrenda, reactivarPrenda } from "../actions";
import type { Tejido } from "@/types/database";

interface FichaPrendaPageProps {
  params: { id: string };
}

const ETIQUETA_TEJIDO: Record<Tejido, string> = {
  algodon: "Algodón",
  poliester: "Poliéster",
  mixto: "Mixto",
  neopreno: "Neopreno",
};

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{valor}</dd>
    </div>
  );
}

export default async function FichaPrendaPage({ params }: FichaPrendaPageProps) {
  const supabase = createClient();
  const [{ data: prenda }, { data: precios }] = await Promise.all([
    supabase
      .from("prendas")
      .select("*, proveedores(nombre)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("precios_prenda")
      .select("*")
      .eq("prenda_id", params.id)
      .order("desde_cantidad"),
  ]);

  if (!prenda) {
    notFound();
  }

  const proveedorNombre =
    (prenda.proveedores as unknown as { nombre: string } | null)?.nombre ?? "—";

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {prenda.nombre}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {prenda.codigo_interno}
          </p>
          <div className="mt-2">
            <Badge variant={prenda.activo ? "default" : "secondary"}>
              {prenda.activo ? "Activa" : "Inactiva"}
            </Badge>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/prendas/${prenda.id}/editar`}>Editar prenda</Link>
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <Campo label="Modelo" valor={prenda.modelo ?? "—"} />
        <Campo label="Proveedor" valor={proveedorNombre} />
        <Campo label="Tejido" valor={ETIQUETA_TEJIDO[prenda.tejido as Tejido]} />
        <Campo
          label="Disponible en oscuro"
          valor={prenda.disponible_oscuro ? "Sí" : "No"}
        />
        {prenda.descripcion && (
          <div className="sm:col-span-2">
            <Campo label="Descripción" valor={prenda.descripcion} />
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-3">
        {prenda.activo ? (
          <form action={desactivarPrenda.bind(null, prenda.id)}>
            <Button type="submit" variant="destructive">
              Desactivar prenda
            </Button>
          </form>
        ) : (
          <form action={reactivarPrenda.bind(null, prenda.id)}>
            <Button type="submit" variant="secondary">
              Reactivar prenda
            </Button>
          </form>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Precios por color, tipo de cliente y cantidad
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Celdas en blanco (PTE) no se aplican en presupuestos hasta que se
          rellenen.
        </p>
        <div className="mt-4">
          {precios?.length ? (
            <PreciosPrendaMatrix prendaId={prenda.id} precios={precios} />
          ) : (
            <p className="text-sm text-danger">
              Esta prenda no tiene filas de precio. Ejecuta el seed de
              configuración inicial.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
