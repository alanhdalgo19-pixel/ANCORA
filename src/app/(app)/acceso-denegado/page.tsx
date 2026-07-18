import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AccesoDenegadoPage() {
  return (
    <main className="flex flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        Acceso denegado
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No tienes permiso para acceder a esta sección. Contacta con el
        administrador si crees que es un error.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
