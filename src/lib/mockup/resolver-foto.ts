// F2.4 — ¿qué foto real hay para esta prenda y este color?
//
// Lo usa el PDF (servidor) para pasarle a `<MockupPDF>` la foto ya firmada.
// La consulta y la firma entran por `PuertosResolverFoto` para poder probar
// la función sin Supabase; la implementación real está en
// `@/lib/prendas-fotos/puertos`.
//
// Devuelve null —y el mockup cae al rectángulo abstracto de F2.2— cuando la
// prenda no tiene foto para ese color o el archivo ya no se puede firmar.

import type { ColorGrupo } from "@/lib/calculos/types";
import type { FormatoFoto } from "@/lib/prendas-fotos/validar";

export interface FotoAlmacenada {
  id: string;
  storage_path: string;
  formato: FormatoFoto;
  ancho_px: number | null;
  alto_px: number | null;
}

export interface PuertosResolverFoto {
  buscarFoto: (prendaId: string, color: ColorGrupo) => Promise<FotoAlmacenada | null>;
  firmarUrl: (ruta: string) => Promise<string | null>;
}

export interface FotoResuelta {
  url: string;
  formato: FormatoFoto;
  ancho_px: number | null;
  alto_px: number | null;
}

export async function resolverFotoPrenda(
  prenda_id: string,
  color_grupo: ColorGrupo,
  puertos: PuertosResolverFoto,
): Promise<FotoResuelta | null> {
  const foto = await puertos.buscarFoto(prenda_id, color_grupo);
  if (!foto) return null;

  const url = await puertos.firmarUrl(foto.storage_path);
  if (!url) return null;

  return {
    url,
    formato: foto.formato,
    ancho_px: foto.ancho_px,
    alto_px: foto.alto_px,
  };
}
