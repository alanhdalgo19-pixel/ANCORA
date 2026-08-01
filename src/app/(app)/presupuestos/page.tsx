import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BotonDescargarPDF } from "@/components/presupuestos/BotonDescargarPDF";
import { BotonDuplicar } from "@/components/presupuestos/BotonDuplicar";
import { EstadoBadge } from "@/components/presupuestos/EstadoBadge";
import { formatEuros, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EstadoPresupuesto } from "@/types/database";

const POR_PAGINA = 20;

const ESTADOS: EstadoPresupuesto[] = [
  "borrador",
  "enviado",
  "aceptado",
  "rechazado",
  "caducado",
];

const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  caducado: "Caducado",
};

interface PresupuestosPageProps {
  searchParams: {
    estado?: string | string[];
    cliente?: string;
    desde?: string;
    hasta?: string;
    q?: string;
    pagina?: string;
  };
}

function comoLista(valor: string | string[] | undefined): string[] {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : [valor];
}

export default async function PresupuestosPage({
  searchParams,
}: PresupuestosPageProps) {
  const supabase = createClient();

  const estadosFiltro = comoLista(searchParams.estado).filter(
    (estado): estado is EstadoPresupuesto =>
      ESTADOS.includes(estado as EstadoPresupuesto),
  );
  const clienteFiltro = searchParams.cliente?.trim() || "";
  const desde = searchParams.desde?.trim() || "";
  const hasta = searchParams.hasta?.trim() || "";
  const busqueda = searchParams.q?.trim() || "";
  const pagina = Math.max(1, Number.parseInt(searchParams.pagina ?? "1", 10) || 1);

  let consulta = supabase
    .from("presupuestos")
    .select(
      "id, numero, fecha_emision, estado, total, clientes(nombre, activo)",
      { count: "exact" },
    )
    .order("fecha_emision", { ascending: false })
    .order("numero", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);

  if (estadosFiltro.length) consulta = consulta.in("estado", estadosFiltro);
  if (clienteFiltro) consulta = consulta.eq("cliente_id", clienteFiltro);
  if (desde) consulta = consulta.gte("fecha_emision", desde);
  if (hasta) consulta = consulta.lte("fecha_emision", hasta);
  if (busqueda) consulta = consulta.ilike("numero", `%${busqueda}%`);

  const [{ data: presupuestos, count }, { data: clientes }] = await Promise.all([
    consulta,
    supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  function urlPagina(numero: number) {
    const params = new URLSearchParams();
    estadosFiltro.forEach((estado) => params.append("estado", estado));
    if (clienteFiltro) params.set("cliente", clienteFiltro);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (busqueda) params.set("q", busqueda);
    if (numero > 1) params.set("pagina", String(numero));
    const cadena = params.toString();
    return cadena ? `/presupuestos?${cadena}` : "/presupuestos";
  }

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Presupuestos</h1>
        <Button asChild>
          <Link href="/presupuestos/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo presupuesto
          </Link>
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {total} {total === 1 ? "presupuesto" : "presupuestos"}
        {totalPaginas > 1 ? ` · página ${pagina} de ${totalPaginas}` : ""}
      </p>

      <form
        method="get"
        className="mt-6 space-y-4 rounded-lg border border-border p-4"
      >
        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Estado
          </legend>
          <div className="flex flex-wrap gap-4">
            {ESTADOS.map((estado) => (
              <label
                key={estado}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="estado"
                  value={estado}
                  defaultChecked={estadosFiltro.includes(estado)}
                  className="h-4 w-4 rounded border-border accent-[var(--ancora-primary)]"
                />
                {ETIQUETA_ESTADO[estado]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Cliente</Label>
            <select
              id="cliente"
              name="cliente"
              defaultValue={clienteFiltro}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos</option>
              {(clientes ?? []).map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input id="desde" name="desde" type="date" defaultValue={desde} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hasta">Hasta</Label>
            <Input id="hasta" name="hasta" type="date" defaultValue={hasta} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q">Número</Label>
            <Input
              id="q"
              name="q"
              type="search"
              placeholder="2026/000090"
              defaultValue={busqueda}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/presupuestos">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha emisión</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presupuestos?.length ? (
              presupuestos.map((presupuesto) => {
                const cliente = Array.isArray(presupuesto.clientes)
                  ? presupuesto.clientes[0]
                  : presupuesto.clientes;

                return (
                  <TableRow key={presupuesto.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/presupuestos/${presupuesto.id}`}
                        className="hover:text-ancora-primary"
                      >
                        {presupuesto.numero}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {(cliente as { nombre?: string } | null)?.nombre ?? "—"}
                      {(cliente as { activo?: boolean } | null)?.activo ===
                        false && (
                        <span className="ml-2 text-xs text-danger">
                          (inactivo)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatFecha(presupuesto.fecha_emision)}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge
                        estado={presupuesto.estado as EstadoPresupuesto}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatEuros(presupuesto.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/presupuestos/${presupuesto.id}`}>
                            Ver
                          </Link>
                        </Button>
                        {/* Los borradores todavía cambian: su PDF se descarga
                            desde la ficha, donde se ve que es provisional. */}
                        {presupuesto.estado !== "borrador" && (
                          <BotonDescargarPDF
                            presupuestoId={presupuesto.id}
                            numero={presupuesto.numero}
                            estado={presupuesto.estado as EstadoPresupuesto}
                            variant="ghost"
                            size="sm"
                            soloIcono
                          />
                        )}
                        <BotonDuplicar presupuestoId={presupuesto.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No hay presupuestos que coincidan con los filtros.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginación"
          className="mt-4 flex items-center justify-end gap-2"
        >
          <Link
            href={urlPagina(pagina - 1)}
            aria-disabled={pagina === 1}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-sm",
              pagina === 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-accent/60",
            )}
          >
            Anterior
          </Link>
          <span className="text-sm text-muted-foreground">
            {pagina} / {totalPaginas}
          </span>
          <Link
            href={urlPagina(pagina + 1)}
            aria-disabled={pagina === totalPaginas}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-sm",
              pagina === totalPaginas
                ? "pointer-events-none opacity-40"
                : "hover:bg-accent/60",
            )}
          >
            Siguiente
          </Link>
        </nav>
      )}
    </main>
  );
}
