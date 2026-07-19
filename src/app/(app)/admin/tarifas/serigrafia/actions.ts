"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function actualizarTarifasSerigrafia(
  filas: { id: string; precio_unitario: number }[],
): Promise<ActionResult> {
  const supabase = createClient();

  const resultados = await Promise.all(
    filas.map((fila) =>
      supabase
        .from("tarifas_serigrafia")
        .update({ precio_unitario: fila.precio_unitario })
        .eq("id", fila.id),
    ),
  );

  if (resultados.some((r) => r.error)) {
    return { error: "No se pudo guardar alguna de las tarifas. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/tarifas/serigrafia");
  revalidatePath("/admin/tarifas/impresion-directa");
  return { success: true };
}

export interface ParametrosSerigrafiaInput {
  recargo_oscura_pecho_por_color: number;
  recargo_oscura_espalda_por_color: number;
  fotolito_pecho: number;
  fotolito_espalda: number;
  minimo_trabajo: number;
  pantone_por_color: number;
  vectorizacion: number;
}

export async function actualizarParametrosSerigrafia(
  datos: ParametrosSerigrafiaInput,
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("parametros_serigrafia")
    .update(datos)
    .eq("id", 1);

  if (error) {
    return { error: "No se pudieron guardar los parámetros de serigrafía." };
  }

  revalidatePath("/admin/tarifas/serigrafia");
  return { success: true };
}
