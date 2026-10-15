// F2.4 — acceso al bucket `prendas-fotos` de Supabase Storage.
//
// Mismo reparto que `logos-clientes` (F2.1): el bucket es privado, la
// aplicación comprueba el rol y solo después lee o escribe el objeto con el
// cliente `service_role`. Las políticas del bucket son la segunda línea.

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ColorGrupo } from "@/types/database";
import { mimeDeFormatoFoto, type FormatoFoto } from "./validar";

export const BUCKET_PRENDAS_FOTOS = "prendas-fotos";

/** TTL de las URLs firmadas (wizard vía redirect y PDF directo). */
export const SEGUNDOS_URL_FIRMADA_FOTO = 60 * 60; // 60 min

/** `{prenda_id}/{color_grupo}-{uuid}.{extension}`: el color se lee en el bucket. */
export function rutaFotoPrenda(
  prendaId: string,
  color: ColorGrupo,
  formato: FormatoFoto,
): string {
  return `${prendaId}/${color}-${randomUUID()}.${formato}`;
}

export async function subirArchivoFoto(
  ruta: string,
  contenido: Uint8Array,
  formato: FormatoFoto,
): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET_PRENDAS_FOTOS)
    .upload(ruta, contenido, {
      contentType: mimeDeFormatoFoto(formato),
      upsert: false,
    });
  return !error;
}

export async function eliminarArchivoFoto(ruta: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET_PRENDAS_FOTOS).remove([ruta]);
  return !error;
}

export async function urlFirmadaFoto(ruta: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET_PRENDAS_FOTOS)
    .createSignedUrl(ruta, SEGUNDOS_URL_FIRMADA_FOTO);
  if (error || !data) return null;
  return data.signedUrl;
}
