"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { obtenerLogo } from "@/lib/logos/consultas";
import {
  eliminarArchivoLogo,
  rutaLogo,
  subirArchivoLogo,
} from "@/lib/logos/subir";
import {
  dimensionesDeImagen,
  validarArchivoLogo,
  validarFirmaArchivo,
} from "@/lib/logos/validar";
import type { Rol } from "@/types/database";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoSubida =
  | { ok: true; logo_id: string }
  | { ok: false; error: string };

const LARGO_MAX_NOMBRE = 120;
const LARGO_MAX_NOTAS = 500;

const ERROR_PERMISO_ESCRITURA =
  "No tienes permiso para modificar los logos de este cliente.";
const ERROR_PERMISO_BORRADO =
  "Solo un administrador puede eliminar logos. Pídeselo a Espe o a Mohamed.";
const ERROR_GENERICO =
  "No se ha podido completar la operación. Inténtalo de nuevo.";

function puedeEscribir(rol: Rol | null): boolean {
  return rol === "admin" || rol === "operador";
}

/** Refresca la pantalla de logos y la ficha del cliente (que muestra el resumen). */
function revalidarCliente(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/logos`);
  revalidatePath(`/clientes/${clienteId}`);
}

function limpiarTexto(valor: FormDataEntryValue | null, largoMax: number): string {
  if (typeof valor !== "string") return "";
  return valor.trim().slice(0, largoMax);
}

/**
 * Deja sin principal al logo que lo fuera. Hay que hacerlo ANTES de marcar el
 * nuevo: la migración tiene un índice único parcial que solo permite un
 * `es_principal = true` por cliente.
 */
async function desmarcarPrincipal(
  supabase: ReturnType<typeof createClient>,
  clienteId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("logos_clientes")
    .update({ es_principal: false })
    .eq("cliente_id", clienteId)
    .eq("es_principal", true);

  return !error;
}

// ---------------------------------------------------------------------------
// F.1 — subir un logo
// ---------------------------------------------------------------------------

/**
 * Sube un logo a la biblioteca del cliente.
 *
 * Recibe `FormData` y no un objeto con campos sueltos porque el archivo viaja
 * dentro: es la forma en que el navegador serializa un `File` hacia una Server
 * Action, y evita depender de la serialización de `File` como argumento.
 *
 * Campos esperados: `cliente_id`, `archivo`, `nombre`, `notas`, `es_principal`.
 */
export async function subirLogo(datos: FormData): Promise<ResultadoSubida> {
  const rol = await getUserRole();
  if (!puedeEscribir(rol)) {
    return { ok: false, error: ERROR_PERMISO_ESCRITURA };
  }

  const clienteId = limpiarTexto(datos.get("cliente_id"), 64);
  const archivo = datos.get("archivo");

  if (!clienteId) {
    return { ok: false, error: "Falta el cliente al que pertenece el logo." };
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

  // 2. El cliente tiene que existir (y RLS tiene que dejar verlo).
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .maybeSingle();

  if (!cliente) {
    return { ok: false, error: "No se ha encontrado el cliente." };
  }

  // 3. Primera capa de validación: tamaño y tipo MIME declarado.
  const validacion = validarArchivoLogo(archivo);
  if (!validacion.valido || !validacion.formato) {
    return { ok: false, error: validacion.error ?? ERROR_GENERICO };
  }
  const formato = validacion.formato;

  // 4. Segunda capa: la firma del contenido real. El navegador puede mentir
  //    con el MIME (lo deduce de la extensión), los bytes no.
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const firma = validarFirmaArchivo(bytes, formato);
  if (!firma.valido) {
    return { ok: false, error: firma.error ?? ERROR_GENERICO };
  }

  const nombre =
    limpiarTexto(datos.get("nombre"), LARGO_MAX_NOMBRE) || archivo.name;
  const notas = limpiarTexto(datos.get("notas"), LARGO_MAX_NOTAS) || null;

  // Si es el primer logo del cliente se marca principal solo: una biblioteca
  // con un único logo y ninguno señalado no le sirve de nada a F2.3, que
  // sugerirá el principal por defecto en el wizard.
  const { count } = await supabase
    .from("logos_clientes")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);

  const esPrincipal = datos.get("es_principal") === "true" || (count ?? 0) === 0;

  // 5-6. Ruta única y subida al bucket.
  const ruta = rutaLogo(clienteId, formato);
  const subida = await subirArchivoLogo(ruta, bytes, formato);
  if (!subida.ok) {
    return {
      ok: false,
      error: "No se ha podido guardar el archivo. Revisa tu conexión.",
    };
  }

  // 7. Solo puede haber un principal por cliente.
  if (esPrincipal) {
    const desmarcado = await desmarcarPrincipal(supabase, clienteId);
    if (!desmarcado) {
      await eliminarArchivoLogo(ruta);
      return { ok: false, error: ERROR_GENERICO };
    }
  }

  // 8. Fila con todos los metadatos.
  const dimensiones = dimensionesDeImagen(bytes, formato);
  const { data: insertado, error } = await supabase
    .from("logos_clientes")
    .insert({
      cliente_id: clienteId,
      nombre,
      storage_path: ruta,
      formato,
      tamano_bytes: archivo.size,
      ancho_px: dimensiones?.ancho ?? null,
      alto_px: dimensiones?.alto ?? null,
      es_principal: esPrincipal,
      subido_por: user.id,
      notas,
    })
    .select("id")
    .single();

  if (error || !insertado) {
    // El archivo ya está en el bucket pero no hay fila que lo referencie:
    // se retira para no dejar huérfanos que nadie pueda ver ni borrar.
    await eliminarArchivoLogo(ruta);
    return { ok: false, error: "No se ha podido guardar el logo." };
  }

  revalidarCliente(clienteId);
  return { ok: true, logo_id: insertado.id as string };
}

// ---------------------------------------------------------------------------
// F.2 — eliminar un logo
// ---------------------------------------------------------------------------

/**
 * Elimina un logo. Solo admin: los logos son propiedad del cliente y borrar
 * uno por error obliga a volver a pedírselo (CLAUDE.md, F2.1).
 *
 * Se borra primero la fila y después el objeto. Si fallara el borrado del
 * objeto quedaría un archivo huérfano en el bucket —invisible e inofensivo—,
 * mientras que al revés quedaría una fila apuntando a un archivo que ya no
 * está, que es lo que sí rompe la pantalla.
 */
export async function eliminarLogo(logoId: string): Promise<ResultadoAccion> {
  const rol = await getUserRole();
  if (rol !== "admin") {
    return { ok: false, error: ERROR_PERMISO_BORRADO };
  }

  const supabase = createClient();
  const logo = await obtenerLogo(supabase, logoId);
  if (!logo) {
    return { ok: false, error: "No se ha encontrado el logo." };
  }

  const { error } = await supabase
    .from("logos_clientes")
    .delete()
    .eq("id", logoId);

  if (error) {
    return { ok: false, error: "No se ha podido eliminar el logo." };
  }

  const borrado = await eliminarArchivoLogo(logo.storage_path);
  if (!borrado) {
    console.error(
      `[logos] fila ${logoId} eliminada pero el objeto ${logo.storage_path} sigue en el bucket`,
    );
  }

  revalidarCliente(logo.cliente_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// F.3 — marcar como principal
// ---------------------------------------------------------------------------

export async function marcarComoPrincipal(
  logoId: string,
): Promise<ResultadoAccion> {
  const rol = await getUserRole();
  if (!puedeEscribir(rol)) {
    return { ok: false, error: ERROR_PERMISO_ESCRITURA };
  }

  const supabase = createClient();
  const logo = await obtenerLogo(supabase, logoId);
  if (!logo) {
    return { ok: false, error: "No se ha encontrado el logo." };
  }
  if (logo.es_principal) {
    return { ok: true };
  }

  const desmarcado = await desmarcarPrincipal(supabase, logo.cliente_id);
  if (!desmarcado) {
    return { ok: false, error: ERROR_GENERICO };
  }

  const { error } = await supabase
    .from("logos_clientes")
    .update({ es_principal: true })
    .eq("id", logoId);

  if (error) {
    return { ok: false, error: "No se ha podido marcar el logo como principal." };
  }

  revalidarCliente(logo.cliente_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// F.4 — renombrar
// ---------------------------------------------------------------------------

export async function renombrarLogo(
  logoId: string,
  nuevoNombre: string,
): Promise<ResultadoAccion> {
  const rol = await getUserRole();
  if (!puedeEscribir(rol)) {
    return { ok: false, error: ERROR_PERMISO_ESCRITURA };
  }

  const nombre = nuevoNombre.trim().slice(0, LARGO_MAX_NOMBRE);
  if (!nombre) {
    return { ok: false, error: "El nombre no puede quedar vacío." };
  }

  const supabase = createClient();
  const logo = await obtenerLogo(supabase, logoId);
  if (!logo) {
    return { ok: false, error: "No se ha encontrado el logo." };
  }

  const { error } = await supabase
    .from("logos_clientes")
    .update({ nombre })
    .eq("id", logoId);

  if (error) {
    return { ok: false, error: "No se ha podido renombrar el logo." };
  }

  revalidarCliente(logo.cliente_id);
  return { ok: true };
}
