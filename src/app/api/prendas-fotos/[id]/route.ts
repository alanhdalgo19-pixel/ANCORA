// GET /api/prendas-fotos/{foto_id} — sirve una foto del catálogo de prendas.
//
// Mismo patrón que `/api/logos/[id]` (F2.1): el bucket `prendas-fotos` es
// privado, así que se comprueba la sesión, se lee la fila con el cliente del
// USUARIO (deciden las políticas RLS de `prendas_fotos`) y se responde con un
// 302 hacia una URL firmada de 60 min. Los bytes no pasan por la lambda.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlFirmadaFoto } from "@/lib/prendas-fotos/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Contexto {
  params: { id: string };
}

export async function GET(_peticion: Request, { params }: Contexto) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: foto } = await supabase
    .from("prendas_fotos")
    .select("storage_path")
    .eq("id", params.id)
    .maybeSingle();
  if (!foto) {
    return NextResponse.json(
      { error: "No se ha encontrado la foto." },
      { status: 404 },
    );
  }

  const url = await urlFirmadaFoto(foto.storage_path as string);
  if (!url) {
    return NextResponse.json(
      { error: "El archivo de la foto ya no está disponible." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(url, {
    status: 302,
    // Al reemplazar una foto el id se conserva: sin `no-store`, el navegador
    // podría seguir enseñando la anterior.
    headers: { "Cache-Control": "private, no-store" },
  });
}
