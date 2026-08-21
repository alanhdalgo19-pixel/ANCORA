"use server";

// Server Actions de la exportación a Excel (Prompt 9).
//
// Dos operaciones: contar lo que hay en el rango (preview de la pantalla) y
// generar el .xlsx marcando los aceptados como volcados a facturación.
//
// Ambas exigen rol `admin`. RLS ya lo impediría en la práctica —las políticas
// del Prompt 2 no dan a operador acceso de escritura sobre `presupuestos` más
// allá de lo suyo— pero aquí devuelve un mensaje entendible en vez de un error
// de base de datos, igual que hace `desactivarCliente` (CLAUDE.md 13.2).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUserRole } from "@/lib/supabase/server";
import {
  cargarDatosExportacion,
  contarExportacion,
  idsAFacturar,
  marcarEnviadosAFacturacion,
  LIMITE_PRESUPUESTOS_EXPORTACION,
  type FiltroExportacion,
  type RecuentoExportacion,
} from "@/lib/exportacion/consultas";
import {
  generarExcel,
  nombreArchivoExportacion,
} from "@/lib/exportacion/generarExcel";
import type { ResultadoAccion } from "@/types/presupuestos";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const esquemaFiltro = z
  .object({
    desde: z.string().regex(FECHA_ISO, "La fecha de inicio no es válida."),
    hasta: z.string().regex(FECHA_ISO, "La fecha de fin no es válida."),
    campo_fecha: z.enum(["fecha_emision", "accepted_at"]),
  })
  .refine((filtro) => filtro.hasta >= filtro.desde, {
    message: "La fecha final no puede ser anterior a la inicial.",
  });

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Comprueba sesión y rol antes de tocar nada. */
async function exigirAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const rol = await getUserRole();
  if (!rol) return fallo("Tu sesión ha caducado. Vuelve a entrar.");
  if (rol !== "admin") {
    return fallo("Solo un administrador puede exportar a facturación.");
  }
  return { ok: true };
}

function validarFiltro(
  entrada: unknown,
): { ok: true; filtro: FiltroExportacion } | { ok: false; error: string } {
  const analisis = esquemaFiltro.safeParse(entrada);
  if (!analisis.success) {
    return fallo(
      analisis.error.issues[0]?.message ?? "Los filtros no son válidos.",
    );
  }
  return { ok: true, filtro: analisis.data };
}

/**
 * Errores de red o de Supabase: se registran completos en el servidor y al
 * usuario se le da un mensaje entendible, sin detalles técnicos.
 */
function errorInesperado(contexto: string, error: unknown): string {
  console.error(`[exportacion] ${contexto}`, error);
  return "No se ha podido conectar con la base de datos. Inténtalo de nuevo en unos segundos.";
}

// ---------------------------------------------------------------------------
// Preview de recuentos
// ---------------------------------------------------------------------------

export async function previsualizarExportacion(
  entrada: unknown,
): Promise<ResultadoAccion<RecuentoExportacion>> {
  const permiso = await exigirAdmin();
  if (!permiso.ok) return permiso;

  const validacion = validarFiltro(entrada);
  if (!validacion.ok) return validacion;

  try {
    const recuento = await contarExportacion(createClient(), validacion.filtro);
    return { ok: true, datos: recuento };
  } catch (error) {
    return fallo(errorInesperado("Fallo al contar el rango", error));
  }
}

// ---------------------------------------------------------------------------
// Generación del Excel
// ---------------------------------------------------------------------------

export interface ExportacionGenerada {
  buffer: Buffer;
  nombreArchivo: string;
  /** Nº de presupuestos aceptados marcados como enviados a facturación. */
  marcados: number;
  total: number;
}

/**
 * Genera el .xlsx del rango y marca los ACEPTADOS como volcados.
 *
 * El orden importa y es intencionado: primero se genera el archivo completo y
 * solo si eso sale bien se marca el flag. Si la generación falla no se marca
 * nada, así que nunca queda un presupuesto "ya facturado" cuyo Excel no llegó a
 * existir. El marcado en sí es un único `update ... in (...)` por lote, atómico
 * en Postgres.
 *
 * `confirmado` es la respuesta a la advertencia de rango grande: sin él, un
 * rango de más de 5.000 presupuestos se rechaza en vez de arriesgar un
 * time-out de la función serverless.
 */
export async function exportarPresupuestos(
  entrada: unknown,
  confirmado = false,
): Promise<ResultadoAccion<ExportacionGenerada>> {
  const permiso = await exigirAdmin();
  if (!permiso.ok) return permiso;

  const validacion = validarFiltro(entrada);
  if (!validacion.ok) return validacion;

  const { filtro } = validacion;
  const supabase = createClient();

  try {
    const datos = await cargarDatosExportacion(supabase, filtro);

    if (
      !confirmado &&
      datos.presupuestos.length > LIMITE_PRESUPUESTOS_EXPORTACION
    ) {
      return fallo(
        `El rango tiene ${datos.presupuestos.length} presupuestos, por encima del límite de ${LIMITE_PRESUPUESTOS_EXPORTACION}. Acorta el rango o confirma que quieres exportarlo igualmente.`,
      );
    }

    const buffer = await generarExcel(datos);

    const aFacturar = idsAFacturar(datos.presupuestos);
    if (aFacturar.length > 0) {
      await marcarEnviadosAFacturacion(
        supabase,
        aFacturar,
        new Date().toISOString(),
      );
      // El listado y la ficha muestran la fecha del último volcado.
      revalidatePath("/admin/exportacion");
      revalidatePath("/presupuestos");
    }

    return {
      ok: true,
      datos: {
        buffer,
        nombreArchivo: nombreArchivoExportacion(filtro.desde, filtro.hasta),
        marcados: aFacturar.length,
        total: datos.presupuestos.length,
      },
    };
  } catch (error) {
    return fallo(errorInesperado("Fallo al generar el Excel", error));
  }
}
