// Pantalla de exportación a Excel (Prompt 9).
//
// Solo admin: el layout de `/admin` ya redirige a `/acceso-denegado` a
// cualquier otro rol, y tanto la Server Action como el route handler vuelven a
// comprobarlo por su cuenta (defensa en profundidad).

import { rangoMesAnterior } from "@/lib/exportacion/consultas";
import { FormularioExportacion } from "./FormularioExportacion";

export const metadata = {
  title: "Exportación a Excel · Ancora",
};

export default function ExportacionPage() {
  const { desde, hasta } = rangoMesAnterior();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Exportación a Excel
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Descarga los presupuestos de un periodo en un archivo{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">.xlsx</code> con
        tres pestañas: <strong>Facturables</strong> (solo aceptados, para
        volcarlos al software de facturación), <strong>Todos</strong> (los cinco
        estados, para análisis) y <strong>Detalle líneas</strong> (una fila por
        línea de los aceptados).
      </p>

      <div className="mt-8 max-w-4xl">
        <FormularioExportacion
          desdePorDefecto={desde}
          hastaPorDefecto={hasta}
        />
      </div>
    </main>
  );
}
