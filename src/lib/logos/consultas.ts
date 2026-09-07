// F2.1 — consultas de la biblioteca de logos.
//
// Único módulo de la carpeta que habla con la tabla `logos_clientes`
// (`validar.ts` es puro y `subir.ts` solo toca el bucket). Mismo patrón que
// `src/lib/metricas/consultas.ts`.
//
// Autorización: se usa siempre el cliente del USUARIO, nunca `service_role`.
// Las políticas RLS de la migración 20260901000000 deciden quién ve qué; las
// Server Actions comprueban además el rol antes de escribir.

import type { createClient } from "@/lib/supabase/server";
import type { LogoCliente } from "@/types/database";

type SupabaseServerClient = ReturnType<typeof createClient>;

const COLUMNAS =
  "id, cliente_id, nombre, storage_path, formato, tamano_bytes, ancho_px, alto_px, es_principal, subido_por, subido_at, notas";

/**
 * Logos de un cliente. El principal primero y el resto por fecha de subida
 * descendente: es el orden en el que Sonia los busca.
 */
export async function listarLogosDeCliente(
  supabase: SupabaseServerClient,
  clienteId: string,
): Promise<LogoCliente[]> {
  const { data } = await supabase
    .from("logos_clientes")
    .select(COLUMNAS)
    .eq("cliente_id", clienteId)
    .order("es_principal", { ascending: false })
    .order("subido_at", { ascending: false });

  return (data ?? []) as LogoCliente[];
}

/** Un logo concreto, o null si no existe o RLS no deja verlo. */
export async function obtenerLogo(
  supabase: SupabaseServerClient,
  logoId: string,
): Promise<LogoCliente | null> {
  const { data } = await supabase
    .from("logos_clientes")
    .select(COLUMNAS)
    .eq("id", logoId)
    .maybeSingle();

  return (data as LogoCliente | null) ?? null;
}

export interface ResumenLogos {
  total: number;
  principal: LogoCliente | null;
}

/**
 * Lo que necesita la tarjeta "Logos" de la ficha del cliente: cuántos hay y
 * cuál es el principal. Se resuelve con una sola consulta porque un cliente
 * tiene un puñado de logos, no miles.
 */
export async function resumenLogosDeCliente(
  supabase: SupabaseServerClient,
  clienteId: string,
): Promise<ResumenLogos> {
  const logos = await listarLogosDeCliente(supabase, clienteId);

  return {
    total: logos.length,
    principal: logos.find((logo) => logo.es_principal) ?? null,
  };
}
