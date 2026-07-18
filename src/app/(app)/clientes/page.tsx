import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TipoClienteBadge } from "@/components/clientes/TipoClienteBadge";
import { cn } from "@/lib/utils";
import type { TipoCliente } from "@/types/database";

interface ClientesPageProps {
  searchParams: { tipo?: string; q?: string };
}

const FILTROS_TIPO: { valor: TipoCliente | undefined; etiqueta: string }[] = [
  { valor: undefined, etiqueta: "Todos" },
  { valor: "esporadico", etiqueta: "Esporádicos" },
  { valor: "habitual", etiqueta: "Habituales" },
];

function esTipoValido(valor: string | undefined): valor is TipoCliente {
  return valor === "esporadico" || valor === "habitual";
}

export default async function ClientesPage({
  searchParams,
}: ClientesPageProps) {
  const supabase = createClient();
  const tipo = esTipoValido(searchParams.tipo) ? searchParams.tipo : undefined;
  const q = searchParams.q?.trim();

  let listado = supabase
    .from("clientes")
    .select("id, nombre, cif, localidad, tipo_cliente, descuento_bordado_pct")
    .eq("activo", true)
    .order("nombre");

  if (tipo) {
    listado = listado.eq("tipo_cliente", tipo);
  }
  if (q) {
    listado = listado.or(
      `nombre.ilike.%${q}%,cif.ilike.%${q}%`,
    );
  }

  const [{ data: clientes }, { count: total }, { count: esporadicos }, { count: habituales }] =
    await Promise.all([
      listado,
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("activo", true),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("activo", true)
        .eq("tipo_cliente", "esporadico"),
      supabase
        .from("clientes")
        .select("id", { count: "exact", head: true })
        .eq("activo", true)
        .eq("tipo_cliente", "habitual"),
    ]);

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
        <Button asChild>
          <Link href="/clientes/nuevo">Nuevo cliente</Link>
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {total ?? 0} clientes ({esporadicos ?? 0} esporádicos, {habituales ?? 0}{" "}
        habituales)
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {FILTROS_TIPO.map((filtro) => {
            const params = new URLSearchParams();
            if (filtro.valor) params.set("tipo", filtro.valor);
            if (q) params.set("q", q);
            const href = params.toString() ? `/clientes?${params}` : "/clientes";
            const activo = tipo === filtro.valor;

            return (
              <Link
                key={filtro.etiqueta}
                href={href}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  activo
                    ? "border-ancora-primary bg-ancora-primary-light text-ancora-primary-dark"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {filtro.etiqueta}
              </Link>
            );
          })}
        </div>

        <form method="get" className="flex gap-2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <Input
            type="search"
            name="q"
            placeholder="Buscar por nombre o CIF…"
            defaultValue={q ?? ""}
            className="w-64"
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>CIF</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descuento bordado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes?.length ? (
              clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell className="font-medium">{cliente.nombre}</TableCell>
                  <TableCell>{cliente.cif ?? "—"}</TableCell>
                  <TableCell>{cliente.localidad ?? "—"}</TableCell>
                  <TableCell>
                    <TipoClienteBadge tipo={cliente.tipo_cliente} />
                  </TableCell>
                  <TableCell>
                    {cliente.tipo_cliente === "habitual"
                      ? `${cliente.descuento_bordado_pct}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/clientes/${cliente.id}`}>Ver ficha</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/clientes/${cliente.id}/editar`}>Editar</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay clientes que coincidan con la búsqueda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
