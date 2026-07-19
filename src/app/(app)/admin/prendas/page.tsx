import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Tejido } from "@/types/database";

interface AdminPrendasPageProps {
  searchParams: { proveedor?: string; tejido?: string };
}

const ETIQUETA_TEJIDO: Record<Tejido, string> = {
  algodon: "Algodón",
  poliester: "Poliéster",
  mixto: "Mixto",
  neopreno: "Neopreno",
};

export default async function AdminPrendasPage({
  searchParams,
}: AdminPrendasPageProps) {
  const supabase = createClient();

  let listado = supabase
    .from("prendas")
    .select("id, codigo_interno, nombre, modelo, tejido, proveedor_id, proveedores(nombre)")
    .eq("activo", true)
    .order("nombre");

  if (searchParams.proveedor) {
    listado = listado.eq("proveedor_id", searchParams.proveedor);
  }
  if (searchParams.tejido) {
    listado = listado.eq("tejido", searchParams.tejido);
  }

  const [{ data: prendas }, { data: proveedores }, { data: preciosPrenda }] =
    await Promise.all([
      listado,
      supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("precios_prenda").select("prenda_id, precio"),
    ]);

  const maximoPrecioPorPrenda = new Map<string, number>();
  for (const fila of preciosPrenda ?? []) {
    const actual = maximoPrecioPorPrenda.get(fila.prenda_id);
    if (actual === undefined || fila.precio > actual) {
      maximoPrecioPorPrenda.set(fila.prenda_id, fila.precio);
    }
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Prendas</h1>
        <Button asChild>
          <Link href="/admin/prendas/nuevo">Nueva prenda</Link>
        </Button>
      </div>

      <div className="mt-4 max-w-2xl rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
        ⚠️ Las prendas cargadas inicialmente están sin precios de coste.
        Recopilar con Esperanza el catálogo completo con precios.
      </div>

      <form method="get" className="mt-6 flex flex-wrap gap-3">
        <select
          name="proveedor"
          defaultValue={searchParams.proveedor ?? ""}
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Todos los proveedores</option>
          {proveedores?.map((proveedor) => (
            <option key={proveedor.id} value={proveedor.id}>
              {proveedor.nombre}
            </option>
          ))}
        </select>
        <select
          name="tejido"
          defaultValue={searchParams.tejido ?? ""}
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Todos los tejidos</option>
          {Object.entries(ETIQUETA_TEJIDO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="mt-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Tejido</TableHead>
              <TableHead>Precios</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prendas?.length ? (
              prendas.map((prenda) => {
                const tienePrecios = (maximoPrecioPorPrenda.get(prenda.id) ?? 0) > 0;
                return (
                  <TableRow key={prenda.id}>
                    <TableCell className="font-mono text-xs">
                      {prenda.codigo_interno}
                    </TableCell>
                    <TableCell className="font-medium">{prenda.nombre}</TableCell>
                    <TableCell>
                      {(prenda.proveedores as unknown as { nombre: string } | null)
                        ?.nombre ?? "—"}
                    </TableCell>
                    <TableCell>{ETIQUETA_TEJIDO[prenda.tejido as Tejido]}</TableCell>
                    <TableCell>
                      <Badge
                        variant={tienePrecios ? "default" : "destructive"}
                        className={cn(!tienePrecios && "bg-danger text-white")}
                      >
                        {tienePrecios ? "Con precios" : "Sin precios"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/prendas/${prenda.id}`}>Ver ficha</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay prendas que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
