"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface ParametrosSublimacionInput {
  precio_unitario_base: number | null;
  cantidad_minima: number | null;
  tasa_merma_pct: number | null;
  solo_blanco_poliester: boolean;
}

export async function actualizarParametrosSublimacion(
  datos: ParametrosSublimacionInput,
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("parametros_sublimacion")
    .update(datos)
    .eq("id", 1);

  if (error) {
    return { error: "No se pudieron guardar los parámetros de sublimación." };
  }

  revalidatePath("/admin/tarifas/sublimacion");
  revalidatePath("/admin");
  return { success: true };
}
