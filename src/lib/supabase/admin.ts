import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con privilegios de `service_role` — ignora RLS por completo.
 * Solo se debe usar en código de servidor (Server Actions, Route Handlers).
 * SUPABASE_SERVICE_ROLE_KEY no tiene el prefijo NEXT_PUBLIC_ y por tanto
 * nunca se envía al navegador.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
