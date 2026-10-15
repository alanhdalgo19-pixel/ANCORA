// F2.3 — URLs de los logos que aparecen en los mockups de un presupuesto.
//
// El PDF se renderiza en el servidor, así que el logo se le pasa a `Image`
// como URL firmada DIRECTA del bucket y no como `/api/logos/{id}`: esa ruta
// exige cookie de sesión y responde con un 302, una ida y vuelta de más en
// cada logo (CLAUDE.md, F2.2 decisión 11).
//
// La fila del logo se lee con el cliente del USUARIO (RLS decide si puede
// verla) y la URL se firma con `service_role`, el mismo reparto que en
// `/api/logos/[id]` y en los PDFs archivados.

import type { ColorGrupo } from "@/lib/calculos/types";
import { urlFirmadaLogo } from "@/lib/logos/subir";
import { resolverFotoPrenda } from "@/lib/mockup/resolver-foto";
import { formatoRasterizable, leerMockupSnapshot } from "@/lib/mockup/snapshot";
import { puertosResolverFotoSupabase } from "@/lib/prendas-fotos/puertos";
import type { createClient } from "@/lib/supabase/server";
import type { LineaVista } from "@/types/presupuestos";
import { claveFotoMockup, type FotoPrendaPDF } from "./MockupPDF";

type SupabaseServerClient = ReturnType<typeof createClient>;

/** Ids de logo PNG/JPG que salen en algún mockup de las líneas. */
export function logosIncrustables(lineas: LineaVista[]): string[] {
  const ids = new Set<string>();
  for (const linea of lineas) {
    if (linea.tipo_linea !== "tecnica") continue;
    const mockup = leerMockupSnapshot(linea.detalle_calculo);
    if (
      mockup?.logo_id &&
      mockup.logos.length > 0 &&
      formatoRasterizable(mockup.logo_formato)
    ) {
      ids.add(mockup.logo_id);
    }
  }
  return Array.from(ids);
}

/**
 * `{ logo_id: url_firmada }` para los logos que se pueden incrustar. Un logo
 * borrado de la biblioteca o sin URL simplemente no aparece: el mockup del PDF
 * lo pinta como caja vacía en vez de impedir generar el documento.
 */
export async function cargarLogosMockup(
  supabase: SupabaseServerClient,
  lineas: LineaVista[],
): Promise<Record<string, string>> {
  const ids = logosIncrustables(lineas);
  if (!ids.length) return {};

  const { data } = await supabase
    .from("logos_clientes")
    .select("id, storage_path")
    .in("id", ids);

  const pares = await Promise.all(
    (data ?? []).map(async (fila) => {
      const url = await urlFirmadaLogo(fila.storage_path as string);
      return url ? ([fila.id as string, url] as const) : null;
    }),
  );

  const resultado: Record<string, string> = {};
  for (const par of pares) {
    if (par) resultado[par[0]] = par[1];
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// F2.4 — fotos de prenda de los mockups
// ---------------------------------------------------------------------------

/** Pares (prenda, color) distintos que salen en algún mockup de las líneas. */
export function fotosNecesarias(
  lineas: LineaVista[],
): { prenda_id: string; color: ColorGrupo }[] {
  const pares = new Map<string, { prenda_id: string; color: ColorGrupo }>();
  for (const linea of lineas) {
    if (linea.tipo_linea !== "tecnica") continue;
    const mockup = leerMockupSnapshot(linea.detalle_calculo);
    if (!mockup?.prenda_id || mockup.logos.length === 0) continue;
    pares.set(claveFotoMockup(mockup.prenda_id, mockup.color_prenda), {
      prenda_id: mockup.prenda_id,
      color: mockup.color_prenda,
    });
  }
  return Array.from(pares.values());
}

/**
 * `{ "prenda:color": foto }` para las prendas con foto real. Solo PNG y JPG:
 * `Image` de @react-pdf/renderer no admite WebP, así que una foto WebP deja
 * esa prenda con el rectángulo abstracto en el PDF (en el navegador sí sale).
 * Sin foto no hay aviso: el PDF lo ve el cliente.
 */
export async function cargarFotosMockup(
  supabase: SupabaseServerClient,
  lineas: LineaVista[],
): Promise<Record<string, FotoPrendaPDF>> {
  const pares = fotosNecesarias(lineas);
  if (!pares.length) return {};

  const puertos = puertosResolverFotoSupabase(supabase);
  const resueltas = await Promise.all(
    pares.map(async ({ prenda_id, color }) => {
      const foto = await resolverFotoPrenda(prenda_id, color, puertos);
      if (!foto || foto.formato === "webp") return null;
      return [
        claveFotoMockup(prenda_id, color),
        { fuente: foto.url, ancho_px: foto.ancho_px, alto_px: foto.alto_px },
      ] as const;
    }),
  );

  const resultado: Record<string, FotoPrendaPDF> = {};
  for (const par of resueltas) {
    if (par) resultado[par[0]] = par[1];
  }
  return resultado;
}
