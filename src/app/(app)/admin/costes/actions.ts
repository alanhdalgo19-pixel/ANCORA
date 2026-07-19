"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function actualizarCostesOperativos(
  filas: { clave: string; valor: number | null }[],
): Promise<ActionResult> {
  const supabase = createClient();

  const resultados = await Promise.all(
    filas.map((fila) =>
      supabase
        .from("costes_operativos")
        .update({ valor: fila.valor })
        .eq("clave", fila.clave),
    ),
  );

  if (resultados.some((r) => r.error)) {
    return { error: "No se pudo guardar algún coste. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/costes");
  return { success: true };
}
