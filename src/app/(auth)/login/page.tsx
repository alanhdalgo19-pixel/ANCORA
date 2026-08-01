import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4">
          {/* El logo hace de titular; el h1 se mantiene para lectores de pantalla. */}
          <h1 className="sr-only">Áncora — Ancora Publicitat</h1>
          <Image
            src="/logo-ancora.png"
            alt="Ancora Publicitat"
            width={569}
            height={158}
            priority
            className="h-12 w-auto"
          />
          <p className="text-sm text-muted-foreground">
            Inicia sesión para continuar
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
