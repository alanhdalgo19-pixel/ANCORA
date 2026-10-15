"use server";

// F2.4 — Server Actions de las fotos de prenda. Solo admin: la ruta ya está
// gateada por `admin/prendas/layout.tsx`, pero una Server Action se puede
// invocar desde fuera, así que el rol se vuelve a comprobar (en el núcleo
// `registrarFotoPrenda` para subir/reemplazar y aquí para eliminar).
//
// Reciben `FormData` cuando viaja un archivo, igual que `subirLogo` (F2.1).

import { revalidatePath } from "next/cache";
import { puertosFotoSupabase } from "@/lib/prendas-fotos/puertos";
import {
  ERROR_PERMISO_FOTOS,
  esColorGrupo,
  registrarFotoPrenda,
} from "@/lib/prendas-fotos/registrar";
import { eliminarArchivoFoto } from "@/lib/prendas-fotos/storage";
import { createClient, getUserRole } from "@/lib/supabase/server";
import type { ColorGrupo } from "@/types/database";

export type ResultadoAccionFoto = { ok: true } | { ok: false; error: string };

function revalidarPrenda(prendaId: string) {
  revalidatePath(`/admin/prendas/${prendaId}/fotos`);
  revalidatePath("/admin/prendas");
}

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim().slice(0, 64) : "";
}

async function usuarioActual() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Sube la foto de una prenda para un grupo de color vacío.
 * Campos: `prenda_id`, `color_grupo`, `archivo`.
 */
export async function subirFotoPrenda(datos: FormData): Promise<ResultadoAccionFoto> {
  const rol = await getUserRole();
  if (rol !== "admin") return { ok: false, error: ERROR_PERMISO_FOTOS };

  const prendaId = texto(datos.get("prenda_id"));
  const color = texto(datos.get("color_grupo"));
  const archivo = datos.get("archivo");
  if (!prendaId || !esColorGrupo(color)) {
    return { ok: false, error: "Faltan la prenda o el grupo de color." };
  }
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se ha recibido ningún archivo." };
  }

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { data: prenda } = await supabase
    .from("prendas")
    .select("id")
    .eq("id", prendaId)
    .maybeSingle();
  if (!prenda) return { ok: false, error: "No se ha encontrado la prenda." };

  const resultado = await registrarFotoPrenda(puertosFotoSupabase(supabase), {
    rol,
    usuarioId: user.id,
    prendaId,
    colorGrupo: color,
    archivo,
    modo: "subir",
  });
  if (!resultado.ok) return resultado;

  revalidarPrenda(prendaId);
  return { ok: true };
}

/** Lee la foto con la sesión del usuario (RLS) para saber prenda, color y ruta. */
async function leerFoto(
  supabase: ReturnType<typeof createClient>,
  fotoId: string,
): Promise<{ prenda_id: string; color_grupo: ColorGrupo; storage_path: string } | null> {
  const { data } = await supabase
    .from("prendas_fotos")
    .select("prenda_id, color_grupo, storage_path")
    .eq("id", fotoId)
    .maybeSingle();
  if (!data || !esColorGrupo(data.color_grupo)) return null;
  return {
    prenda_id: data.prenda_id as string,
    color_grupo: data.color_grupo,
    storage_path: data.storage_path as string,
  };
}

/**
 * Sustituye una foto por otra en una sola operación: la fila se actualiza en
 * sitio, así que la prenda nunca se queda sin foto. Campos: `foto_id`, `archivo`.
 */
export async function reemplazarFotoPrenda(
  datos: FormData,
): Promise<ResultadoAccionFoto> {
  const rol = await getUserRole();
  if (rol !== "admin") return { ok: false, error: ERROR_PERMISO_FOTOS };

  const fotoId = texto(datos.get("foto_id"));
  const archivo = datos.get("archivo");
  if (!fotoId) return { ok: false, error: "Falta la foto que reemplazar." };
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se ha recibido ningún archivo." };
  }

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };

  const foto = await leerFoto(supabase, fotoId);
  if (!foto) return { ok: false, error: "No se ha encontrado la foto." };

  const resultado = await registrarFotoPrenda(puertosFotoSupabase(supabase), {
    rol,
    usuarioId: user.id,
    prendaId: foto.prenda_id,
    colorGrupo: foto.color_grupo,
    archivo,
    modo: "reemplazar",
  });
  if (!resultado.ok) return resultado;

  revalidarPrenda(foto.prenda_id);
  return { ok: true };
}

/**
 * Elimina una foto. Primero la fila y después el objeto, como los logos
 * (F2.1, decisión 6): un archivo huérfano es inofensivo; una fila sin archivo
 * deja el mockup con una imagen rota.
 */
export async function eliminarFotoPrenda(fotoId: string): Promise<ResultadoAccionFoto> {
  const rol = await getUserRole();
  if (rol !== "admin") return { ok: false, error: ERROR_PERMISO_FOTOS };

  const supabase = createClient();
  const foto = await leerFoto(supabase, fotoId);
  if (!foto) return { ok: false, error: "No se ha encontrado la foto." };

  const { error } = await supabase.from("prendas_fotos").delete().eq("id", fotoId);
  if (error) return { ok: false, error: "No se ha podido eliminar la foto." };

  const borrado = await eliminarArchivoFoto(foto.storage_path);
  if (!borrado) {
    console.error(
      `[prendas-fotos] fila ${fotoId} eliminada pero ${foto.storage_path} sigue en el bucket`,
    );
  }

  revalidarPrenda(foto.prenda_id);
  return { ok: true };
}
