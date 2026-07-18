import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span
            className="h-12 w-12 rounded-full bg-ancora-primary"
            aria-hidden="true"
          />
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">Áncora</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inicia sesión para continuar
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
