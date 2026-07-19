"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function actualizarTiposPicaje(
  filas: { id: string; precio_base: number }[],
): Promise<ActionResult> {
  const supabase = createClient();

  const resultados = await Promise.all(
    filas.map((fila) =>
      supabase
        .from("tipos_picaje")
        .update({ precio_base: fila.precio_base })
        .eq("id", fila.id),
    ),
  );

  if (resultados.some((r) => r.error)) {
    return { error: "No se pudo guardar algún tipo de picaje. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/tarifas/picaje");
  return { success: true };
}
