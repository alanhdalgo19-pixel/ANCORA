"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUserRole } from "@/lib/supabase/server";
import type { TipoCliente } from "@/types/database";

export interface ClienteInput {
  nombre: string;
  cif: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  provincia: string | null;
  persona_contacto: string | null;
  condiciones_pago: string | null;
  tipo_cliente: TipoCliente;
  descuento_bordado_pct: number;
}

interface ActionResult {
  error: string;
}

export async function crearCliente(
  datos: ClienteInput,
): Promise<ActionResult | void> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clientes")
    .insert(datos)
    .select("id")
    .single();

  if (error) {
    return { error: "No se pudo crear el cliente. Inténtalo de nuevo." };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function actualizarCliente(
  id: string,
  datos: ClienteInput,
): Promise<ActionResult | void> {
  const supabase = createClient();

  const { error } = await supabase.from("clientes").update(datos).eq("id", id);

  if (error) {
    return { error: "No se pudo actualizar el cliente. Inténtalo de nuevo." };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function cambiarTipoCliente(id: string, nuevoTipo: TipoCliente) {
  const supabase = createClient();

  const { error } = await supabase
    .from("clientes")
    .update({ tipo_cliente: nuevoTipo })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo cambiar el tipo de cliente");
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

/**
 * Solo admin puede desactivar. RLS permite a operador hacer UPDATE en
 * `clientes` (incluida la columna `activo`), así que la comprobación de rol
 * tiene que vivir aquí: es la única barrera si alguien manipula el HTML
 * para hacer aparecer el botón — CLAUDE.md, prompt de esta sesión, sección
 * "Restricciones por rol en la UI".
 */
export async function desactivarCliente(id: string) {
  const rol = await getUserRole();

  if (rol !== "admin") {
    throw new Error("No tienes permiso para desactivar clientes");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ activo: false })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo desactivar el cliente");
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}
