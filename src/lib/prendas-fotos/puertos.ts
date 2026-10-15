// Implementaciones reales de los puertos de F2.4: la tabla `prendas_fotos` se
// toca con el cliente del USUARIO (deciden sus políticas RLS) y el bucket con
// `service_role` (ver `storage.ts`), igual que los logos de F2.1.

import type { PuertosResolverFoto } from "@/lib/mockup/resolver-foto";
import type { createClient } from "@/lib/supabase/server";
import { esFormatoFoto } from "./validar";
import type { PuertosFotoPrenda } from "./registrar";
import {
  eliminarArchivoFoto,
  rutaFotoPrenda,
  subirArchivoFoto,
  urlFirmadaFoto,
} from "./storage";

type SupabaseServerClient = ReturnType<typeof createClient>;

export function puertosFotoSupabase(
  supabase: SupabaseServerClient,
): PuertosFotoPrenda {
  return {
    fotoPrincipal: async (prendaId, color) => {
      const { data } = await supabase
        .from("prendas_fotos")
        .select("id, storage_path")
        .eq("prenda_id", prendaId)
        .eq("color_grupo", color)
        .eq("es_principal", true)
        .maybeSingle();
      return data
        ? { id: data.id as string, storage_path: data.storage_path as string }
        : null;
    },
    rutaNueva: rutaFotoPrenda,
    subirArchivo: subirArchivoFoto,
    eliminarArchivo: eliminarArchivoFoto,
    insertarFila: async (fila) => {
      const { data, error } = await supabase
        .from("prendas_fotos")
        .insert(fila)
        .select("id")
        .single();
      return error || !data ? null : (data.id as string);
    },
    actualizarFila: async (id, cambios) => {
      const { error } = await supabase
        .from("prendas_fotos")
        .update({ ...cambios, subido_at: new Date().toISOString() })
        .eq("id", id);
      return !error;
    },
  };
}

export function puertosResolverFotoSupabase(
  supabase: SupabaseServerClient,
): PuertosResolverFoto {
  return {
    buscarFoto: async (prendaId, color) => {
      const { data } = await supabase
        .from("prendas_fotos")
        .select("id, storage_path, formato, ancho_px, alto_px")
        .eq("prenda_id", prendaId)
        .eq("color_grupo", color)
        .eq("es_principal", true)
        .maybeSingle();
      if (!data || !esFormatoFoto(data.formato)) return null;
      return {
        id: data.id as string,
        storage_path: data.storage_path as string,
        formato: data.formato,
        ancho_px: (data.ancho_px as number | null) ?? null,
        alto_px: (data.alto_px as number | null) ?? null,
      };
    },
    firmarUrl: urlFirmadaFoto,
  };
}
