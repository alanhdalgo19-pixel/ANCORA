"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Tejido } from "@/types/database";

export interface PrendaInput {
  codigo_interno: string;
  nombre: string;
  modelo: string | null;
  proveedor_id: string;
  tejido: Tejido;
  disponible_oscuro: boolean;
  descripcion: string | null;
}

interface ActionResult {
  error: string;
}

export async function crearPrenda(
  datos: PrendaInput,
): Promise<ActionResult | void> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("prendas")
    .insert(datos)
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo crear la prenda. Comprueba que el código interno no esté repetido." };
  }

  revalidatePath("/admin/prendas");
  redirect(`/admin/prendas/${data.id}`);
}

export async function actualizarPrenda(
  id: string,
  datos: PrendaInput,
): Promise<ActionResult | void> {
  const supabase = createClient();

  const { error } = await supabase.from("prendas").update(datos).eq("id", id);

  if (error) {
    return { error: "No se pudo actualizar la prenda. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/prendas");
  revalidatePath(`/admin/prendas/${id}`);
  redirect(`/admin/prendas/${id}`);
}

export async function desactivarPrenda(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("prendas")
    .update({ activo: false })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo desactivar la prenda");
  }

  revalidatePath("/admin/prendas");
  redirect("/admin/prendas");
}

export async function reactivarPrenda(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("prendas")
    .update({ activo: true })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo reactivar la prenda");
  }

  revalidatePath("/admin/prendas");
  revalidatePath(`/admin/prendas/${id}`);
}

interface ActionResultSimple {
  error?: string;
  success?: boolean;
}

export async function actualizarPreciosPrenda(
  prendaId: string,
  filas: { id: string; precio: number }[],
): Promise<ActionResultSimple> {
  const supabase = createClient();

  const resultados = await Promise.all(
    filas.map((fila) =>
      supabase.from("precios_prenda").update({ precio: fila.precio }).eq("id", fila.id),
    ),
  );

  if (resultados.some((r) => r.error)) {
    return { error: "No se pudo guardar algún precio. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/prendas");
  revalidatePath(`/admin/prendas/${prendaId}`);
  revalidatePath("/admin");
  return { success: true };
}
