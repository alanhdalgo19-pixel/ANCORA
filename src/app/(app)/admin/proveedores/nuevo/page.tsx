import { ProveedorForm } from "@/components/admin/ProveedorForm";

export default function NuevoProveedorPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Nuevo proveedor
      </h1>
      <div className="mt-6">
        <ProveedorForm />
      </div>
    </main>
  );
}
