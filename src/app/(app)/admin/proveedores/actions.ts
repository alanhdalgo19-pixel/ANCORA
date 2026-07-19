"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TipoProveedor } from "@/types/database";

export interface ProveedorInput {
  nombre: string;
  tipo: TipoProveedor | null;
  dias_entrega: number | null;
}

interface ActionResult {
  error: string;
}

export async function crearProveedor(
  datos: ProveedorInput,
): Promise<ActionResult | void> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("proveedores")
    .insert(datos)
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo crear el proveedor. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/proveedores");
  redirect(`/admin/proveedores/${data.id}`);
}

export async function actualizarProveedor(
  id: string,
  datos: ProveedorInput,
): Promise<ActionResult | void> {
  const supabase = createClient();

  const { error } = await supabase.from("proveedores").update(datos).eq("id", id);

  if (error) {
    return { error: "No se pudo actualizar el proveedor. Inténtalo de nuevo." };
  }

  revalidatePath("/admin/proveedores");
  revalidatePath(`/admin/proveedores/${id}`);
  redirect(`/admin/proveedores/${id}`);
}

export async function desactivarProveedor(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({ activo: false })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo desactivar el proveedor");
  }

  revalidatePath("/admin/proveedores");
  redirect("/admin/proveedores");
}

export async function reactivarProveedor(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("proveedores")
    .update({ activo: true })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo reactivar el proveedor");
  }

  revalidatePath("/admin/proveedores");
  revalidatePath(`/admin/proveedores/${id}`);
}
