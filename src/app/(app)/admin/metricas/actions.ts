"use server";

// Server Actions del panel de métricas (Prompt 10).
//
// Dos operaciones: las métricas completas de un rango (dashboard) y solo la
// actividad del mes en curso (widget de `/admin`).
//
// Autorización: `admin` Y `operador`. Es una decisión explícita de Alan —
// Mohamed le pide números a Sonia, así que Sonia tiene que poder verlos— y
// todos ven exactamente las mismas cifras, sin ocultar importes por rol. El rol
// `consulta` queda fuera. RLS ya deja leer las tablas implicadas a los tres
// roles, así que este guard es lo que separa a `consulta`, y se repite aquí
// además del gate del layout por defensa en profundidad.

import { z } from "zod";
import { createClient, getUserRole } from "@/lib/supabase/server";
import {
  calcularActividadDelRango,
  calcularMetricas,
} from "@/lib/metricas/calcularMetricas";
import { rangoMesActual, type RangoFechas } from "@/lib/metricas/periodos";
import type { Actividad, Metricas } from "@/lib/metricas/tipos";
import type { ResultadoAccion } from "@/types/presupuestos";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const esquemaRango = z
  .object({
    desde: z.string().regex(FECHA_ISO, "La fecha de inicio no es válida."),
    hasta: z.string().regex(FECHA_ISO, "La fecha de fin no es válida."),
  })
  .refine((rango) => rango.hasta >= rango.desde, {
    message: "La fecha final no puede ser anterior a la inicial.",
  });

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Comprueba sesión y rol antes de tocar nada. */
async function exigirAdminUOperador(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const rol = await getUserRole();
  if (!rol) return fallo("Tu sesión ha caducado. Vuelve a entrar.");
  if (rol !== "admin" && rol !== "operador") {
    return fallo("No tienes permiso para consultar las métricas.");
  }
  return { ok: true };
}

/**
 * Errores de red o de Supabase: se registran completos en el servidor y al
 * usuario se le da un mensaje entendible, sin detalles técnicos.
 */
function errorInesperado(contexto: string, error: unknown): string {
  console.error(`[metricas] ${contexto}`, error);
  return "No se han podido cargar las métricas. Inténtalo de nuevo en unos segundos.";
}

/** Métricas completas del rango: los cinco bloques del dashboard. */
export async function obtenerMetricas(
  entrada: unknown,
): Promise<ResultadoAccion<Metricas>> {
  const permiso = await exigirAdminUOperador();
  if (!permiso.ok) return permiso;

  const analisis = esquemaRango.safeParse(entrada);
  if (!analisis.success) {
    return fallo(analisis.error.issues[0]?.message ?? "El rango no es válido.");
  }

  try {
    const metricas = await calcularMetricas(
      createClient(),
      analisis.data as RangoFechas,
    );
    return { ok: true, datos: metricas };
  } catch (error) {
    return fallo(errorInesperado("Fallo al calcular las métricas", error));
  }
}

/**
 * Solo el bloque de actividad del mes en curso. El widget de `/admin` no pinta
 * alertas ni catálogo, así que no se pagan sus consultas.
 */
export async function obtenerActividadMesActual(): Promise<
  ResultadoAccion<{ rango: RangoFechas; actividad: Actividad }>
> {
  const permiso = await exigirAdminUOperador();
  if (!permiso.ok) return permiso;

  const rango = rangoMesActual();

  try {
    const actividad = await calcularActividadDelRango(createClient(), rango);
    return { ok: true, datos: { rango, actividad } };
  } catch (error) {
    return fallo(errorInesperado("Fallo al calcular el resumen", error));
  }
}
