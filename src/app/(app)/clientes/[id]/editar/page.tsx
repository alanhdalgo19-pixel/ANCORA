import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "@/components/clientes/ClienteForm";

interface EditarClientePageProps {
  params: { id: string };
}

export default async function EditarClientePage({
  params,
}: EditarClientePageProps) {
  const supabase = createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!cliente) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Editar cliente
      </h1>
      <div className="mt-6">
        <ClienteForm cliente={cliente} />
      </div>
    </main>
  );
}
