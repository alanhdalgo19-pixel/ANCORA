// Implementación real de `PuertosRegistroLogo`: la tabla se toca con el
// cliente del USUARIO (deciden las políticas RLS de `logos_clientes`) y el
// bucket con `service_role` (ver `subir.ts`), igual que en F2.1.

import type { createClient } from "@/lib/supabase/server";
import type { PuertosRegistroLogo } from "./registrar";
import { eliminarArchivoLogo, rutaLogo, subirArchivoLogo } from "./subir";

type SupabaseServerClient = ReturnType<typeof createClient>;

export function puertosSupabase(
  supabase: SupabaseServerClient,
): PuertosRegistroLogo {
  return {
    contarLogos: async (clienteId) => {
      const { count } = await supabase
        .from("logos_clientes")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId);
      return count ?? 0;
    },
    rutaNueva: rutaLogo,
    subirArchivo: subirArchivoLogo,
    eliminarArchivo: eliminarArchivoLogo,
    desmarcarPrincipal: async (clienteId) => {
      // Hay que hacerlo ANTES de marcar el nuevo: la migración tiene un índice
      // único parcial que solo permite un `es_principal = true` por cliente.
      const { error } = await supabase
        .from("logos_clientes")
        .update({ es_principal: false })
        .eq("cliente_id", clienteId)
        .eq("es_principal", true);
      return !error;
    },
    insertarFila: async (fila) => {
      const { data, error } = await supabase
        .from("logos_clientes")
        .insert(fila)
        .select("id")
        .single();
      return error || !data ? null : (data.id as string);
    },
  };
}
