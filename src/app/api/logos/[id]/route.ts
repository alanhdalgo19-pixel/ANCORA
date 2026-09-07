// GET /api/logos/{logo_id} — sirve un logo de la biblioteca de un cliente.
//
// El bucket `logos-clientes` es privado, así que no hay URL pública que meter
// en un `<img src>`. Este handler comprueba sesión y rol, genera una URL
// firmada de 60 min y responde con un 302 hacia ella: el navegador se descarga
// la imagen directamente del CDN de Supabase sin que los bytes pasen por la
// lambda.
//
// Autorización: la fila se lee con el cliente del USUARIO, de modo que deciden
// las políticas RLS de `logos_clientes`. Si no puede verla respondemos 404 y no
// 403, igual que en `/api/presupuestos/[id]/pdf`: no le confirmamos que exista.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerLogo } from "@/lib/logos/consultas";
import { urlFirmadaLogo } from "@/lib/logos/subir";

// `service_role` y `node:crypto` en la capa de Storage: no vale el runtime Edge.
export const runtime = "nodejs";
// La URL firmada caduca; no se puede cachear la respuesta.
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

  const logo = await obtenerLogo(supabase, params.id);
  if (!logo) {
    return NextResponse.json(
      { error: "No se ha encontrado el logo." },
      { status: 404 },
    );
  }

  const url = await urlFirmadaLogo(logo.storage_path);
  if (!url) {
    return NextResponse.json(
      { error: "El archivo del logo ya no está disponible." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      // El destino lleva una firma temporal y material del cliente: que no
      // quede en caches intermedias ni sobreviva a un cambio de logo.
      "Cache-Control": "private, no-store",
    },
  });
}
