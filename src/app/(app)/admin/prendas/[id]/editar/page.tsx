import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrendaForm } from "@/components/admin/PrendaForm";

interface EditarPrendaPageProps {
  params: { id: string };
}

export default async function EditarPrendaPage({ params }: EditarPrendaPageProps) {
  const supabase = createClient();
  const [{ data: prenda }, { data: proveedores }] = await Promise.all([
    supabase.from("prendas").select("*").eq("id", params.id).single(),
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  if (!prenda) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Editar prenda</h1>
      <div className="mt-6">
        <PrendaForm prenda={prenda} proveedores={proveedores ?? []} />
      </div>
    </main>
  );
}
