import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { desactivarProveedor, reactivarProveedor } from "../actions";

interface FichaProveedorPageProps {
  params: { id: string };
}

const ETIQUETA_TIPO: Record<string, string> = {
  urgencia: "Urgencia",
  precio: "Precio",
  calidad: "Calidad",
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

export default async function FichaProveedorPage({
  params,
}: FichaProveedorPageProps) {
  const supabase = createClient();
  const { data: proveedor } = await supabase
    .from("proveedores")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!proveedor) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {proveedor.nombre}
          </h1>
          <div className="mt-2">
            <Badge variant={proveedor.activo ? "default" : "secondary"}>
              {proveedor.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/proveedores/${proveedor.id}/editar`}>
            Editar proveedor
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <Campo
          label="Tipo"
          valor={proveedor.tipo ? ETIQUETA_TIPO[proveedor.tipo] : "—"}
        />
        <Campo
          label="Días de entrega"
          valor={proveedor.dias_entrega?.toString() ?? "—"}
        />
      </dl>

      <div className="flex flex-wrap gap-3">
        {proveedor.activo ? (
          <form action={desactivarProveedor.bind(null, proveedor.id)}>
            <Button type="submit" variant="destructive">
              Desactivar proveedor
            </Button>
          </form>
        ) : (
          <form action={reactivarProveedor.bind(null, proveedor.id)}>
            <Button type="submit" variant="secondary">
              Reactivar proveedor
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
