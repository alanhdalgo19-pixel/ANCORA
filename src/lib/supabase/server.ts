import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Rol } from "@/types/database";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component; el middleware refresca la sesión.
          }
        },
      },
    },
  );
}

/** Rol del usuario autenticado actual, o null si no hay sesión o no consta en `usuarios`. */
export async function getUserRole(): Promise<Rol | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();

  return usuario?.rol ?? null;
}
