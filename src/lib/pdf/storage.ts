// Acceso al bucket `presupuestos-pdf` de Supabase Storage.
//
// El bucket es privado. La aplicación NUNCA lo abre con la sesión del usuario:
// el route handler comprueba primero que ese usuario puede leer el presupuesto
// (RLS, con su propio cliente) y solo después lee o escribe el objeto con el
// cliente `service_role`. Así la autorización vive en un único sitio —las
// políticas de `presupuestos`— en vez de duplicarse en políticas de Storage que
// tendrían que reconstruir la relación objeto → presupuesto a partir del nombre
// del archivo.
//
// Los nombres y rutas viven en `nombres.ts` (módulo puro, sin service_role).

import { createAdminClient } from "@/lib/supabase/admin";

export const BUCKET_PDF = "presupuestos-pdf";

/**
 * Archiva el PDF en el bucket y devuelve su ruta.
 * `upsert` activado: reemitir o regenerar debe sobrescribir el archivo anterior
 * en vez de dejar huérfanos con sufijos.
 */
export async function subirPDF(
  ruta: string,
  contenido: Buffer,
): Promise<{ ok: true; ruta: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET_PDF)
    .upload(ruta, contenido, { contentType: "application/pdf", upsert: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, ruta };
}

/** Descarga el PDF archivado. Devuelve null si el objeto ya no está. */
export async function descargarPDF(ruta: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET_PDF).download(ruta);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
