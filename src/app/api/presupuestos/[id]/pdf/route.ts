// GET /api/presupuestos/{id}/pdf — descarga el PDF del presupuesto.
//
// Es un route handler y no una Server Action a propósito: el navegador tiene
// que recibir el archivo con `Content-Disposition: attachment` para disparar la
// descarga, y una Server Action solo devuelve datos serializados.
//
// Autorización: se lee el presupuesto con el cliente del USUARIO, de modo que
// las políticas RLS de `presupuestos` deciden. Si no puede leerlo, la consulta
// no devuelve nada y respondemos 404 (no 403: no le confirmamos que exista).
//
// Reglas de archivo (CLAUDE.md 7.6, inmutabilidad):
//   · borrador → se genera al vuelo en cada descarga y NO se archiva; sigue
//     cambiando, así que no hay documento definitivo que guardar.
//   · emitido/aceptado/rechazado/caducado → se sirve el archivo del bucket tal
//     cual. Solo se (re)genera si nunca llegó a archivarse o si quedó marcado
//     como pendiente de regeneración.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generarPresupuestoPDF,
  generarYArchivarPDF,
} from "@/lib/pdf/generarPDF";
import { nombreArchivoPDF } from "@/lib/pdf/nombres";
import { descargarPDF } from "@/lib/pdf/storage";
import type { EstadoPresupuesto } from "@/types/database";

// @react-pdf/renderer necesita APIs de Node (streams, Buffer): no vale Edge.
export const runtime = "nodejs";
// Cada descarga refleja el estado actual del presupuesto.
export const dynamic = "force-dynamic";

interface Contexto {
  params: { id: string };
}

function respuestaPDF(buffer: Buffer, numero: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivoPDF(numero)}"`,
      "Content-Length": String(buffer.length),
      // Documento con datos de cliente: que no quede en caches intermedias.
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(_peticion: Request, { params }: Contexto) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select("id, numero, estado, pdf_storage_path, pdf_regeneracion_pendiente")
    .eq("id", params.id)
    .maybeSingle();

  if (!presupuesto) {
    return NextResponse.json(
      { error: "No se ha encontrado el presupuesto." },
      { status: 404 },
    );
  }

  const numero = presupuesto.numero as string;
  const estado = presupuesto.estado as EstadoPresupuesto;
  const rutaArchivada = presupuesto.pdf_storage_path as string | null;
  const regeneracionPendiente =
    presupuesto.pdf_regeneracion_pendiente === true;

  try {
    // ── Borrador: al vuelo, sin archivar ──────────────────────────────
    if (estado === "borrador") {
      const generado = await generarPresupuestoPDF(supabase, params.id);
      if (!generado) {
        return NextResponse.json(
          { error: "No se ha encontrado el presupuesto." },
          { status: 404 },
        );
      }
      return respuestaPDF(generado.buffer, generado.numero);
    }

    // ── Emitido: se sirve el archivo tal cual ─────────────────────────
    if (rutaArchivada && !regeneracionPendiente) {
      const archivado = await descargarPDF(rutaArchivada);
      if (archivado) return respuestaPDF(archivado, numero);
      // El objeto ya no está en el bucket: se reconstruye más abajo.
    }

    const resultado = await generarYArchivarPDF(supabase, params.id);
    if (!resultado.ok) {
      // El PDF sí se pudo generar; lo que falló fue archivarlo. Se sirve igual
      // para no dejar a Sonia sin documento por un problema de Storage.
      const generado = await generarPresupuestoPDF(supabase, params.id);
      if (generado) return respuestaPDF(generado.buffer, generado.numero);

      return NextResponse.json(
        { error: "No se ha podido generar el PDF del presupuesto." },
        { status: 500 },
      );
    }

    return respuestaPDF(resultado.buffer, resultado.numero);
  } catch (error) {
    console.error("[pdf] Error generando el presupuesto", params.id, error);
    return NextResponse.json(
      { error: "No se ha podido generar el PDF del presupuesto." },
      { status: 500 },
    );
  }
}
