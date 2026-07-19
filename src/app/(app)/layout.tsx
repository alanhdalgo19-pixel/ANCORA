import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shared/Topbar";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, activo, rol")
    .eq("id", user.id)
    .single();

  // El middleware ya cierra sesión y redirige a los usuarios inexistentes o
  // desactivados (es el único sitio donde se puede limpiar la cookie); esto
  // es una salvaguarda defensiva por si se llega aquí de otro modo.
  if (!usuario || !usuario.activo) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar nombre={usuario.nombre} rol={usuario.rol} />
      <main>{children}</main>
    </div>
  );
}
