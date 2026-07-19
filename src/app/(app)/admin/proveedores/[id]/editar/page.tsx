import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProveedorForm } from "@/components/admin/ProveedorForm";

interface EditarProveedorPageProps {
  params: { id: string };
}

export default async function EditarProveedorPage({
  params,
}: EditarProveedorPageProps) {
  const supabase = createClient();
  const { data: proveedor } = await supabase
    .from("proveedores")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!proveedor) {
    notFound();
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Editar proveedor
      </h1>
      <div className="mt-6">
        <ProveedorForm proveedor={proveedor} />
      </div>
    </main>
  );
}
