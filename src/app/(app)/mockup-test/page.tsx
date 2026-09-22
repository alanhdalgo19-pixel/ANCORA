// F2.2 — pantalla interna para validar el componente `<Mockup>` aislado.
//
// Solo admin (gate en `layout.tsx`) y sin enlace en la topbar: es una
// herramienta de desarrollo, no una pantalla productiva. En F2.3 el mockup
// vivirá dentro del paso 4 del wizard.
//
// El servidor carga la lista de clientes con cuántos logos tiene cada uno y los
// logos del primero que tenga alguno, para que la vista previa salga pintada
// desde el primer render. Los cambios de cliente posteriores van por la Server
// Action `cargarLogosCliente`.

import { createClient } from "@/lib/supabase/server";
import { cargarLogosCliente, type LogoParaMockup } from "./actions";
import { SelectorMockup, type ClienteConLogos } from "./SelectorMockup";

export const metadata = {
  title: "Prueba de mockup · Ancora",
};

export default async function MockupTestPage() {
  const supabase = createClient();

  const [{ data: clientes }, { data: filasLogos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("logos_clientes").select("cliente_id"),
  ]);

  const logosPorCliente = new Map<string, number>();
  for (const { cliente_id } of filasLogos ?? []) {
    logosPorCliente.set(cliente_id, (logosPorCliente.get(cliente_id) ?? 0) + 1);
  }

  const listaClientes: ClienteConLogos[] = (clientes ?? []).map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    num_logos: logosPorCliente.get(cliente.id) ?? 0,
  }));

  const clienteInicial =
    listaClientes.find((cliente) => cliente.num_logos > 0) ?? null;

  let logosIniciales: LogoParaMockup[] = [];
  if (clienteInicial) {
    const resultado = await cargarLogosCliente(clienteInicial.id);
    if (resultado.ok) logosIniciales = resultado.datos;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Prueba de mockup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantalla interna para validar la composición del logo sobre una
          prenda abstracta a escala real. Las medidas de las prendas son
          aproximadas y no afectan al presupuesto.
        </p>
      </div>

      <SelectorMockup
        clientes={listaClientes}
        clienteInicialId={clienteInicial?.id ?? null}
        logosIniciales={logosIniciales}
      />
    </main>
  );
}
