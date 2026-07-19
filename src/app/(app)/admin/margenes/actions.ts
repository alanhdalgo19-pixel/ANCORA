"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function actualizarTramosMargen(
  filas: { id: string; margen_pct: number }[],
): Promise<ActionResult> {
  const supabase = createClient();

  const resultados = await Promise.all(
    filas.map((fila) =>
      supabase
        .from("tramos_margen")
        .update({ margen_pct: fila.margen_pct })
        .eq("id", fila.id),
    ),
  );

  if (resultados.some((r) => r.error)) {
    return { error: "No se pudo guardar algún tramo de margen. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/margenes");
  return { success: true };
}
