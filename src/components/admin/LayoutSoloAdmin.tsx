// Gate de rol para las subrutas de configuración de `/admin` (Prompt 10).
//
// Hasta el Prompt 9, `/admin/layout.tsx` cerraba TODO el panel a `admin`. El
// panel de métricas lo abre también a `operador` (Sonia tiene que poder ver los
// números), así que el gate de admin baja un nivel: cada carpeta de
// configuración (`prendas`, `tarifas`, `margenes`, `costes`, `proveedores`,
// `usuarios`, `exportacion`) tiene un `layout.tsx` que reexporta este
// componente.
//
// Ventaja frente a comprobar el rol página a página: una página nueva dentro de
// esas carpetas queda protegida sola, sin que nadie tenga que acordarse.

import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";

export default async function LayoutSoloAdmin({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rol = await getUserRole();

  if (rol !== "admin") {
    redirect("/acceso-denegado");
  }

  return <>{children}</>;
}
