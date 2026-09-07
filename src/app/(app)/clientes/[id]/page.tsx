import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { resumenLogosDeCliente } from "@/lib/logos/consultas";
import { Button } from "@/components/ui/button";
import { TipoClienteBadge } from "@/components/clientes/TipoClienteBadge";
import { cambiarTipoCliente, desactivarCliente } from "../actions";

interface FichaClientePageProps {
  params: { id: string };
}

function Campo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{valor || "—"}</dd>
    </div>
  );
}

export default async function FichaClientePage({
  params,
}: FichaClientePageProps) {
  const supabase = createClient();
  const [{ data: cliente }, rol] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", params.id).single(),
    getUserRole(),
  ]);

  if (!cliente) {
    notFound();
  }

  const logos = await resumenLogosDeCliente(supabase, cliente.id);
  const esAdmin = rol === "admin";
  const nuevoTipo = cliente.tipo_cliente === "habitual" ? "esporadico" : "habitual";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {cliente.nombre}
          </h1>
          <div className="mt-2">
            <TipoClienteBadge tipo={cliente.tipo_cliente} />
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/clientes/${cliente.id}/editar`}>Editar cliente</Link>
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <Campo label="CIF" valor={cliente.cif} />
        <Campo label="Email" valor={cliente.email} />
        <Campo label="Teléfono" valor={cliente.telefono} />
        <Campo label="Persona de contacto" valor={cliente.persona_contacto} />
        <Campo label="Dirección" valor={cliente.direccion} />
        <Campo label="Código postal" valor={cliente.codigo_postal} />
        <Campo label="Localidad" valor={cliente.localidad} />
        <Campo label="Provincia" valor={cliente.provincia} />
        {cliente.tipo_cliente === "habitual" && (
          <Campo
            label="Descuento bordado"
            valor={`${cliente.descuento_bordado_pct}%`}
          />
        )}
        {cliente.condiciones_pago && (
          <div className="sm:col-span-2">
            <Campo label="Condiciones de pago" valor={cliente.condiciones_pago} />
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-3">
        <form action={cambiarTipoCliente.bind(null, cliente.id, nuevoTipo)}>
          <Button type="submit" variant="secondary">
            Marcar como {nuevoTipo === "habitual" ? "habitual" : "esporádico"}
          </Button>
        </form>

        {esAdmin && (
          <form action={desactivarCliente.bind(null, cliente.id)}>
            <Button type="submit" variant="destructive">
              Desactivar cliente
            </Button>
          </form>
        )}
      </div>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Logos</h2>

        {logos.total === 0 ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Este cliente aún no tiene logos guardados.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/clientes/${cliente.id}/logos`}>+ Añadir logo</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Este cliente tiene {logos.total}{" "}
              {logos.total === 1 ? "logo guardado" : "logos guardados"}.
            </p>
            {logos.principal && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
                <Star
                  className="h-3.5 w-3.5 fill-current text-ancora-primary"
                  aria-hidden="true"
                />
                Principal: {logos.principal.nombre}
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/clientes/${cliente.id}/logos`}>
                Gestionar logos →
              </Link>
            </Button>
          </>
        )}
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Presupuestos de este cliente
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sin presupuestos aún.
        </p>
      </section>
    </main>
  );
}
