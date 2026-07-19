"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export interface ParametrosImpresionDirectaInput {
  solo_algodon: boolean;
  minimo_trabajo: number;
}

export async function actualizarParametrosImpresionDirecta(
  datos: ParametrosImpresionDirectaInput,
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("parametros_impresion_directa")
    .update(datos)
    .eq("id", 1);

  if (error) {
    return {
      error: "No se pudieron guardar los parámetros de impresión directa.",
    };
  }

  revalidatePath("/admin/tarifas/impresion-directa");
  return { success: true };
}
