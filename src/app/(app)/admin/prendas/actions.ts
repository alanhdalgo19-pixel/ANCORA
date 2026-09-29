"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { esTipoPrenda } from "@/lib/mockup/dimensiones-prendas";
import { createClient, getUserRole } from "@/lib/supabase/server";
import type { Tejido, TipoMockup } from "@/types/database";

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

/**
 * F2.3 — guarda en bloque el tipo de mockup de varias prendas (columna
 * "Tipo mockup" del listado). Mismo patrón que `actualizarPreciosPrenda`:
 * un update por fila, todos en paralelo.
 *
 * `/admin/prendas` ya está limitado a admin por su layout y RLS restringe la
 * escritura en `prendas`; aun así se comprueba el rol porque una Server Action
 * es un endpoint que se puede invocar desde fuera de la pantalla.
 */
export async function actualizarTiposMockup(
  cambios: { id: string; tipo_mockup: TipoMockup | null }[],
): Promise<ActionResultSimple> {
  const rol = await getUserRole();
  if (rol !== "admin") {
    return { error: "Solo un administrador puede cambiar el tipo de mockup." };
  }

  if (
    cambios.some(
      (cambio) =>
        cambio.tipo_mockup !== null && !esTipoPrenda(cambio.tipo_mockup),
    )
  ) {
    return { error: "Hay un tipo de mockup no válido." };
  }
  if (!cambios.length) return { success: true };

  const supabase = createClient();
  const resultados = await Promise.all(
    cambios.map((cambio) =>
      supabase
        .from("prendas")
        .update({ tipo_mockup: cambio.tipo_mockup })
        .eq("id", cambio.id),
    ),
  );

  if (resultados.some((r) => r.error)) {
    return { error: "No se pudo guardar algún tipo. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/prendas");
  return { success: true };
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
