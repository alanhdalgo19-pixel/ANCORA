"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UnidadMedidaBordado } from "@/types/database";

export interface ParametrosBordadoInput {
  precio_tarifa_1: number;
  precio_tarifa_2: number;
  precio_tarifa_3: number;
  precio_personalizable_default: number;
  unidad_medida: UnidadMedidaBordado;
  minimo_pieza: number;
  minimo_trabajo: number;
}

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function actualizarParametrosBordado(
  datos: ParametrosBordadoInput,
): Promise<ActionResult> {
  const supabase = createClient();

  const { error } = await supabase
    .from("parametros_bordado")
    .update(datos)
    .eq("id", 1);

  if (error) {
    return { error: "No se pudieron guardar los parámetros de bordado." };
  }

  revalidatePath("/admin/tarifas/bordado");
  return { success: true };
}
