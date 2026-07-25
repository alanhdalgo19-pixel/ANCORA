import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cargarPresupuestoCompleto } from "@/lib/presupuestos/cargar-presupuesto";
import { PresupuestoPreview } from "@/components/presupuestos/PresupuestoPreview";

export default async function PreviewPresupuestoPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const datos = await cargarPresupuestoCompleto(supabase, params.id);

  if (!datos) notFound();

  return (
    <main className="min-h-screen bg-muted p-8">
      <div className="mx-auto mb-4 flex max-w-[820px] items-center justify-between">
        <Link
          href={`/presupuestos/${params.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al presupuesto
        </Link>
        <p className="text-xs text-muted-foreground">
          Vista previa. La descarga en PDF llega en la siguiente entrega.
        </p>
      </div>

      <PresupuestoPreview
        presupuesto={datos.presupuesto}
        cliente={datos.cliente}
        nombreEmisor={datos.nombreEmisor}
        lineas={datos.lineas}
      />
    </main>
  );
}
