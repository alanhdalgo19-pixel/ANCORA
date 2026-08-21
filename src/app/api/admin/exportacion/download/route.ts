// GET /api/admin/exportacion/download — descarga el Excel de exportación.
//
// Es un route handler y no una Server Action por el mismo motivo que el PDF de
// presupuestos (`/api/presupuestos/[id]/pdf`): el navegador necesita recibir el
// archivo como respuesta HTTP para descargarlo, y una Server Action solo
// devuelve datos serializados.
//
// El trabajo real (validar, consultar, generar y marcar el flag) vive en la
// Server Action `exportarPresupuestos`; aquí solo se traduce su resultado a
// códigos de estado HTTP.

import { NextResponse } from "next/server";
import { getUserRole } from "@/lib/supabase/server";
import { exportarPresupuestos } from "@/app/(app)/admin/exportacion/actions";

// ExcelJS usa APIs de Node (Buffer, streams): no vale el runtime Edge.
export const runtime = "nodejs";
// Cada descarga refleja el estado actual de la base de datos.
export const dynamic = "force-dynamic";

const TIPO_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(peticion: Request) {
  const rol = await getUserRole();
  if (!rol) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (rol !== "admin") {
    return NextResponse.json(
      { error: "Solo un administrador puede exportar a facturación." },
      { status: 403 },
    );
  }

  const parametros = new URL(peticion.url).searchParams;
  const resultado = await exportarPresupuestos(
    {
      desde: parametros.get("desde") ?? "",
      hasta: parametros.get("hasta") ?? "",
      campo_fecha: parametros.get("campo_fecha") ?? "",
    },
    parametros.get("confirmado") === "1",
  );

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  const { buffer, nombreArchivo, marcados, total } = resultado.datos;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Content-Length": String(buffer.length),
      // Datos fiscales de clientes: que no quede en caches intermedias.
      "Cache-Control": "private, no-store",
      // Los lee la pantalla para confirmar qué se ha marcado.
      "X-Ancora-Marcados": String(marcados),
      "X-Ancora-Total": String(total),
    },
  });
}
