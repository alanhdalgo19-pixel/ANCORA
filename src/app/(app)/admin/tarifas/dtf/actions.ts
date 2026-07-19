"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ParametrosDtfInput {
  ancho_rollo_cm: number;
  precio_metro: number;
  recorte_por_logo: number;
  mano_obra_por_minuto: number;
  preparacion_pct: number;
  minimo_trabajo: number;
  margen_seguridad_cm: number;
  minutos_setup_fijo: number;
  minutos_por_logo: number;
}

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function actualizarParametrosDTF(
  datos: ParametrosDtfInput,
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("parametros_dtf")
    .update(datos)
    .eq("id", 1);

  if (error) {
    return { error: "No se pudieron guardar los parámetros de DTF." };
  }

  revalidatePath("/admin/tarifas/dtf");
  return { success: true };
}
