import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase/server";

export default async function AdminLayout({
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
