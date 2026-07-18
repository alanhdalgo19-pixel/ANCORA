import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { pathname } = request.nextUrl;
  const esRutaLogin = pathname === "/login";
  const esRutaApi = pathname.startsWith("/api");

  // Las rutas de API gestionan su propia autenticación (no se redirige a /login).
  if (esRutaApi) {
    return supabaseResponse;
  }

  // Copiamos las cookies ya escritas en supabaseResponse (p. ej. el token
  // refrescado, o la limpieza de sesión de un signOut) sobre la respuesta
  // de redirección, que si no partiría de una respuesta "en blanco".
  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (!esRutaLogin) {
      return redirectTo("/login");
    }
    return supabaseResponse;
  }

  // Un Server Component no puede escribir cookies, así que la verificación
  // de "usuario existe y está activo en `usuarios`" (y el cierre de sesión
  // correspondiente) vive aquí, en middleware, donde sí se pueden limpiar.
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("activo")
    .eq("id", user.id)
    .single();

  if (!usuario || !usuario.activo) {
    await supabase.auth.signOut();
    if (!esRutaLogin) {
      return redirectTo("/login");
    }
    return supabaseResponse;
  }

  if (esRutaLogin) {
    return redirectTo("/");
  }

  return supabaseResponse;
}
