import { ClienteForm } from "@/components/clientes/ClienteForm";

export default function NuevoClientePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Nuevo cliente</h1>
      <div className="mt-6">
        <ClienteForm />
      </div>
    </main>
  );
}
