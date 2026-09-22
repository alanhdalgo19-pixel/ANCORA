"use server";

// F2.2 — Server Action de la pantalla de prueba del mockup.
//
// Solo lectura: devuelve los logos de un cliente con la URL por la que el SVG
// puede cargarlos. La pantalla es solo para admin; el layout ya lo impide, pero
// una Server Action es un endpoint público y se comprueba otra vez aquí
// (mismo patrón que `exigirAdmin` en la exportación del Prompt 9).

import { z } from "zod";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { listarLogosDeCliente } from "@/lib/logos/consultas";
import type { FormatoLogo } from "@/types/database";
import type { ResultadoAccion } from "@/types/presupuestos";

export interface LogoParaMockup {
  id: string;
  nombre: string;
  formato: FormatoLogo;
  es_principal: boolean;
  /** `/api/logos/{id}`: redirige a una URL firmada del bucket privado. */
  url: string;
  /** Un PDF no se puede pintar dentro de un `<image>` SVG. */
  previsualizable: boolean;
}

export async function cargarLogosCliente(
  clienteId: string,
): Promise<ResultadoAccion<LogoParaMockup[]>> {
  const rol = await getUserRole();
  if (rol !== "admin") {
    return { ok: false, error: "Solo un administrador puede usar esta pantalla." };
  }

  // `guid` y no `uuid`: en Zod 4 `uuid` exige la variante RFC y rechazaría ids
  // escritos a mano en los seeds. Aquí solo interesa que tenga forma de id.
  const id = z.guid().safeParse(clienteId);
  if (!id.success) {
    return { ok: false, error: "El cliente seleccionado no es válido." };
  }

  const logos = await listarLogosDeCliente(createClient(), id.data);

  return {
    ok: true,
    datos: logos.map((logo) => ({
      id: logo.id,
      nombre: logo.nombre,
      formato: logo.formato,
      es_principal: logo.es_principal,
      url: `/api/logos/${logo.id}`,
      previsualizable: logo.formato !== "pdf",
    })),
  };
}
