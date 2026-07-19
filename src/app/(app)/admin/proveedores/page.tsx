import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ETIQUETA_TIPO: Record<string, string> = {
  urgencia: "Urgencia",
  precio: "Precio",
  calidad: "Calidad",
};

export default async function AdminProveedoresPage() {
  const supabase = createClient();
  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, nombre, tipo, dias_entrega")
    .eq("activo", true)
    .order("nombre");

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Proveedores</h1>
        <Button asChild>
          <Link href="/admin/proveedores/nuevo">Nuevo proveedor</Link>
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {proveedores?.length ?? 0} proveedores activos
      </p>

      <div className="mt-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Días de entrega</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proveedores?.length ? (
              proveedores.map((proveedor) => (
                <TableRow key={proveedor.id}>
                  <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                  <TableCell>
                    {proveedor.tipo ? ETIQUETA_TIPO[proveedor.tipo] : "—"}
                  </TableCell>
                  <TableCell>{proveedor.dias_entrega ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/proveedores/${proveedor.id}`}>
                          Ver ficha
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/proveedores/${proveedor.id}/editar`}>
                          Editar
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay proveedores.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
