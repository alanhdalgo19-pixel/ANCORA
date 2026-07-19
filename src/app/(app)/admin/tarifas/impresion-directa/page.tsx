import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParametrosImpresionDirectaForm } from "@/components/admin/ParametrosImpresionDirectaForm";

export default async function AdminTarifasImpresionDirectaPage() {
  const supabase = createClient();

  const [{ data: tarifasReferencia }, { data: parametros }] = await Promise.all([
    supabase
      .from("tarifas_serigrafia")
      .select("*")
      .eq("tipo_cliente", "esporadico")
      .order("ubicacion")
      .order("num_colores")
      .order("desde_cantidad"),
    supabase.from("parametros_impresion_directa").select("*").eq("id", 1).single(),
  ]);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Impresión directa
      </h1>

      <div className="mt-4 max-w-2xl rounded-lg border border-ancora-primary/30 bg-ancora-primary-light p-4 text-sm text-ancora-primary-dark">
        Impresión directa hereda las tarifas de serigrafía, sin sumar
        fotolitos ni pantones. Para cambiar los precios por unidad, edita la{" "}
        <Link href="/admin/tarifas/serigrafia" className="underline">
          tarifa base de serigrafía
        </Link>
        .
      </div>

      <div className="mt-6 max-w-2xl rounded-lg border border-border">
        <div className="border-b border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground">
          Valores de referencia (tarifa esporádico)
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ubicación</TableHead>
              <TableHead>Colores</TableHead>
              <TableHead>Tramo</TableHead>
              <TableHead>Precio (€/ud.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarifasReferencia?.map((fila) => (
              <TableRow key={fila.id}>
                <TableCell className="capitalize">{fila.ubicacion}</TableCell>
                <TableCell>{fila.num_colores}</TableCell>
                <TableCell>
                  {fila.desde_cantidad}-{fila.hasta_cantidad}
                </TableCell>
                <TableCell>{fila.precio_unitario.toFixed(2)} €</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="text-lg font-semibold text-foreground">
          Restricciones propias
        </h2>
        <div className="mt-4">
          {parametros ? (
            <ParametrosImpresionDirectaForm parametros={parametros} />
          ) : (
            <p className="text-sm text-danger">
              No se encontraron los parámetros de impresión directa. Ejecuta
              el seed de configuración inicial.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
