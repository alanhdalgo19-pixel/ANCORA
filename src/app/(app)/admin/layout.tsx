import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rol = await getUserRole();

  if (rol !== "admin") {
    redirect("/acceso-denegado");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
