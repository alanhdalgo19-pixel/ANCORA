"use server";

// F2.3 — acciones del paso 4 del wizard de línea.

import { revalidatePath } from "next/cache";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { puertosSupabase } from "@/lib/logos/puertos";
import { registrarLogo } from "@/lib/logos/registrar";
import { aLogoWizard } from "@/lib/presupuestos/cargar-wizard";
import type { LogoWizard, ResultadoAccion } from "@/types/presupuestos";

const LARGO_MAX_NOMBRE = 120;

/**
 * "+ Subir" del selector de logo: sube un logo a la biblioteca del cliente del
 * presupuesto y lo devuelve para que el wizard lo deje seleccionado.
 *
 * Diferencias con `subirLogo` (ficha del cliente, F2.1):
 *   · Recibe `presupuesto_id`, no `cliente_id`: el cliente se deduce del
 *     presupuesto, así no se puede colgar un logo en la biblioteca de otro.
 *   · NUNCA marca el logo como principal, ni siquiera si es el primero: es un
 *     logo para esta línea y no debe cambiar la sugerencia por defecto.
 * Las validaciones (5 MB, PNG/JPG/SVG/PDF, firma del contenido) son las mismas
 * porque las dos pasan por `registrarLogo`.
 *
 * Campos del `FormData`: `presupuesto_id`, `archivo`, `nombre` (opcional).
 */
export async function subirLogoPuntual(
  datos: FormData,
): Promise<ResultadoAccion<LogoWizard>> {
  // Mismo reparto que F2.1: admin y operador suben; consulta no.
  const rol = await getUserRole();
  if (rol !== "admin" && rol !== "operador") {
    return {
      ok: false,
      error: "No tienes permiso para subir logos a este cliente.",
    };
  }

  const presupuestoId = datos.get("presupuesto_id");
  const archivo = datos.get("archivo");
  if (typeof presupuestoId !== "string" || !presupuestoId) {
    return { ok: false, error: "Falta el presupuesto." };
  }
  if (!(archivo instanceof File)) {
    return { ok: false, error: "No se ha recibido ningún archivo." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };
  }

  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select("cliente_id")
    .eq("id", presupuestoId)
    .maybeSingle();
  if (!presupuesto) {
    return { ok: false, error: "No se ha encontrado el presupuesto." };
  }
  const clienteId = presupuesto.cliente_id as string;

  const nombre = datos.get("nombre");
  const resultado = await registrarLogo(puertosSupabase(supabase), {
    modo: "puntual",
    clienteId,
    usuarioId: user.id,
    archivo,
    nombre:
      typeof nombre === "string" ? nombre.trim().slice(0, LARGO_MAX_NOMBRE) : "",
    notas: null,
    esPrincipalSolicitado: false,
  });

  if (!resultado.ok) return resultado;

  // La biblioteca del cliente ha cambiado aunque la subida venga del wizard.
  revalidatePath(`/clientes/${clienteId}/logos`);
  revalidatePath(`/clientes/${clienteId}`);

  return {
    ok: true,
    datos: aLogoWizard({
      id: resultado.logo_id,
      nombre: resultado.nombre,
      formato: resultado.formato,
      es_principal: resultado.es_principal,
    }),
  };
}
