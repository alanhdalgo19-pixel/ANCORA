// F2.1 — pantalla de gestión de logos de un cliente.
//
// Primer ladrillo de Fase 2: aquí solo se suben, listan y borran archivos. La
// composición del logo sobre la prenda llega en F2.2 y su uso desde el wizard
// en F2.3.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { listarLogosDeCliente } from "@/lib/logos/consultas";
import { Button } from "@/components/ui/button";
import { ListaLogos } from "./ListaLogos";
import { SubirLogo } from "./SubirLogo";

interface LogosClientePageProps {
  params: { id: string };
}

export default async function LogosClientePage({
  params,
}: LogosClientePageProps) {
  const supabase = createClient();

  const [{ data: cliente }, rol] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("id", params.id).single(),
    getUserRole(),
  ]);

  if (!cliente) {
    notFound();
  }

  const logos = await listarLogosDeCliente(supabase, cliente.id);
  const puedeEscribir = rol === "admin" || rol === "operador";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Logos de {cliente.nombre}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Los logos guardados aquí se podrán reutilizar en los presupuestos de
          este cliente.
        </p>
      </div>

      {puedeEscribir && (
        <SubirLogo clienteId={cliente.id} tieneLogos={logos.length > 0} />
      )}

      <ListaLogos
        logos={logos}
        puedeEscribir={puedeEscribir}
        esAdmin={rol === "admin"}
      />

      <Button asChild variant="outline">
        <Link href={`/clientes/${cliente.id}`}>
          <ArrowLeft aria-hidden="true" />
          Volver a la ficha del cliente
        </Link>
      </Button>
    </main>
  );
}
