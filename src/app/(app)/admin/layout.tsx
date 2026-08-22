import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Desde el Prompt 10 el panel deja entrar también a `operador`: Sonia ve el
// resumen de `/admin` y el dashboard de `/admin/metricas`, con las mismas
// cifras que Espe. Todo lo que es configuración (tarifas, prendas, márgenes,
// costes, proveedores, usuarios, exportación) sigue cerrado a admin mediante el
// `layout.tsx` de cada una de esas carpetas.
export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rol = await getUserRole();

  if (rol !== "admin" && rol !== "operador") {
    redirect("/acceso-denegado");
  }

  return (
    <div className="flex">
      <AdminSidebar esAdmin={rol === "admin"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
