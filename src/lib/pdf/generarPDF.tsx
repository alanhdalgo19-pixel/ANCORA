// Renderiza el PDF de un presupuesto y, cuando procede, lo archiva en Storage.
//
// El archivo es `.tsx` y no `.ts` porque monta el árbol de React del documento;
// escribirlo con `createElement` para conservar la extensión obligaría a un
// cast sobre el tipo de `renderToBuffer` y no aportaría nada.
//
// La carga de datos recibe el cliente Supabase de quien llama en vez de crear
// uno de `service_role`: así el PDF solo puede contener presupuestos que ese
// usuario ya podía leer por RLS, y no hace falta un segundo control de acceso
// dentro de esta función. El `service_role` se reserva para el bucket
// (ver `storage.ts`).

import { renderToBuffer } from "@react-pdf/renderer";
import { EMPRESA } from "@/lib/empresa";
import { cargarPresupuestoCompleto } from "@/lib/presupuestos/cargar-presupuesto";
import type { createClient } from "@/lib/supabase/server";
import { PresupuestoPDF } from "./PresupuestoPDF";
import { rutaStoragePDF } from "./nombres";
import { subirPDF } from "./storage";

type SupabaseServerClient = ReturnType<typeof createClient>;

export interface PDFGenerado {
  buffer: Buffer;
  numero: string;
}

/** Genera el PDF en memoria. No toca Storage. */
export async function generarPresupuestoPDF(
  supabase: SupabaseServerClient,
  presupuestoId: string,
): Promise<PDFGenerado | null> {
  const datos = await cargarPresupuestoCompleto(supabase, presupuestoId);
  if (!datos) return null;

  const buffer = await renderToBuffer(
    <PresupuestoPDF
      presupuesto={datos.presupuesto}
      cliente={datos.cliente}
      nombreEmisor={datos.nombreEmisor}
      lineas={datos.lineas}
      empresa={EMPRESA}
    />,
  );

  return { buffer, numero: datos.presupuesto.numero };
}

/**
 * Genera el PDF, lo sube al bucket y guarda la ruta en el presupuesto.
 *
 * Se usa al emitir (borrador → enviado) y como red de seguridad al descargar un
 * presupuesto ya emitido que todavía no tiene PDF archivado (por ejemplo, los
 * emitidos antes de existir esta función).
 *
 * Si falla la subida se deja `pdf_regeneracion_pendiente = true`: el
 * presupuesto sigue siendo válido y la siguiente descarga vuelve a intentarlo,
 * en vez de servir un archivo que no está.
 */
export async function generarYArchivarPDF(
  supabase: SupabaseServerClient,
  presupuestoId: string,
): Promise<
  { ok: true; buffer: Buffer; numero: string } | { ok: false; error: string }
> {
  const generado = await generarPresupuestoPDF(supabase, presupuestoId);
  if (!generado) return { ok: false, error: "No se ha encontrado el presupuesto." };

  const ruta = rutaStoragePDF(generado.numero);
  const subida = await subirPDF(ruta, generado.buffer);

  if (!subida.ok) {
    await supabase
      .from("presupuestos")
      .update({ pdf_regeneracion_pendiente: true })
      .eq("id", presupuestoId);
    return { ok: false, error: subida.error };
  }

  await supabase
    .from("presupuestos")
    .update({ pdf_storage_path: ruta, pdf_regeneracion_pendiente: false })
    .eq("id", presupuestoId);

  return { ok: true, buffer: generado.buffer, numero: generado.numero };
}
