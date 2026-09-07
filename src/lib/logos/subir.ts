// F2.1 — acceso al bucket `logos-clientes` de Supabase Storage.
//
// El bucket es privado. La aplicación NUNCA lo abre con la sesión del usuario:
// las Server Actions comprueban primero el rol y solo después leen o escriben
// el objeto con el cliente `service_role`. Es exactamente el mismo reparto que
// en `src/lib/pdf/storage.ts` (Prompt 7, decisión 6): la autorización vive en
// un único sitio —la aplicación— y las políticas del bucket son la segunda
// línea de defensa por si se filtrara una clave anónima.

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { mimeDeFormato, type FormatoLogo } from "./validar";

export const BUCKET_LOGOS = "logos-clientes";

/** TTL de las URLs firmadas que sirve `/api/logos/[id]`. */
export const SEGUNDOS_URL_FIRMADA = 60 * 60; // 60 min

/**
 * Ruta dentro del bucket: `{cliente_id}/{uuid}.{extension}`.
 * El nombre original no se usa como ruta a propósito — puede traer acentos,
 * espacios o barras, y dos clientes pueden subir "logo.png" el mismo día.
 */
export function rutaLogo(clienteId: string, formato: FormatoLogo): string {
  return `${clienteId}/${randomUUID()}.${formato}`;
}

export type ResultadoStorage =
  | { ok: true; ruta: string }
  | { ok: false; error: string };

/** Sube el archivo al bucket. Sin `upsert`: cada logo estrena ruta. */
export async function subirArchivoLogo(
  ruta: string,
  contenido: Uint8Array,
  formato: FormatoLogo,
): Promise<ResultadoStorage> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET_LOGOS)
    .upload(ruta, contenido, {
      contentType: mimeDeFormato(formato),
      upsert: false,
    });

  if (error) return { ok: false, error: error.message };
  return { ok: true, ruta };
}

/**
 * Borra el objeto del bucket. Devuelve false si no se pudo: quien llama decide
 * si eso es fatal (limpieza tras un insert fallido) o solo digno de log
 * (borrado de un logo cuya fila ya no está).
 */
export async function eliminarArchivoLogo(ruta: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET_LOGOS).remove([ruta]);
  return !error;
}

/** URL firmada temporal para servir el logo desde el CDN de Supabase. */
export async function urlFirmadaLogo(ruta: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET_LOGOS)
    .createSignedUrl(ruta, SEGUNDOS_URL_FIRMADA);

  if (error || !data) return null;
  return data.signedUrl;
}
