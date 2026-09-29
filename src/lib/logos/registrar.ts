// Núcleo de la subida de un logo, compartido por las dos puertas de entrada:
//   · "biblioteca" — `subirLogo`, desde la ficha del cliente (F2.1).
//   · "puntual"    — `subirLogoPuntual`, desde el paso 4 del wizard (F2.3).
//
// Se extrajo de la Server Action de F2.1 para que las dos subidas validen
// exactamente igual (tamaño, MIME y firma del contenido) y para poder testear
// el flujo sin Supabase: todo lo que toca base de datos o Storage entra por
// `PuertosRegistroLogo`, que en producción implementan las Server Actions y en
// los tests un doble en memoria.
//
// La autorización (rol, sesión, cliente visible) NO vive aquí: la comprueba
// cada Server Action antes de llamar, igual que antes de la extracción.

import type { ResultadoStorage } from "./subir";
import {
  dimensionesDeImagen,
  validarArchivoLogo,
  validarFirmaArchivo,
  type FormatoLogo,
} from "./validar";

export type ModoSubidaLogo = "biblioteca" | "puntual";

export interface FilaNuevoLogo {
  cliente_id: string;
  nombre: string;
  storage_path: string;
  formato: FormatoLogo;
  tamano_bytes: number;
  ancho_px: number | null;
  alto_px: number | null;
  es_principal: boolean;
  subido_por: string;
  notas: string | null;
}

export interface PuertosRegistroLogo {
  contarLogos: (clienteId: string) => Promise<number>;
  rutaNueva: (clienteId: string, formato: FormatoLogo) => string;
  subirArchivo: (
    ruta: string,
    contenido: Uint8Array,
    formato: FormatoLogo,
  ) => Promise<ResultadoStorage>;
  eliminarArchivo: (ruta: string) => Promise<boolean>;
  /** Deja sin principal al logo que lo fuera. false si falla. */
  desmarcarPrincipal: (clienteId: string) => Promise<boolean>;
  /** Inserta la fila y devuelve su id, o null si falla. */
  insertarFila: (fila: FilaNuevoLogo) => Promise<string | null>;
}

export interface EntradaRegistroLogo {
  modo: ModoSubidaLogo;
  clienteId: string;
  usuarioId: string;
  archivo: File;
  /** Vacío → se usa el nombre del archivo. */
  nombre: string;
  notas: string | null;
  /** Solo en modo "biblioteca": el checkbox "marcar como principal". */
  esPrincipalSolicitado: boolean;
}

export type ResultadoRegistroLogo =
  | {
      ok: true;
      logo_id: string;
      nombre: string;
      formato: FormatoLogo;
      es_principal: boolean;
    }
  | { ok: false; error: string };

const ERROR_GENERICO =
  "No se ha podido completar la operación. Inténtalo de nuevo.";

/**
 * ¿Se marca principal? En la biblioteca, si se pide o si es el primer logo del
 * cliente (F2.1, decisión 4). En la subida puntual, nunca: es un logo para UNA
 * línea y no debe cambiar el que el wizard sugiere en los demás presupuestos.
 */
export function decidirPrincipal(
  modo: ModoSubidaLogo,
  solicitado: boolean,
  logosExistentes: number,
): boolean {
  if (modo === "puntual") return false;
  return solicitado || logosExistentes === 0;
}

export async function registrarLogo(
  puertos: PuertosRegistroLogo,
  entrada: EntradaRegistroLogo,
): Promise<ResultadoRegistroLogo> {
  const { archivo, clienteId } = entrada;

  // 1. Tamaño y tipo MIME declarado.
  const validacion = validarArchivoLogo(archivo);
  if (!validacion.valido || !validacion.formato) {
    return { ok: false, error: validacion.error ?? ERROR_GENERICO };
  }
  const formato = validacion.formato;

  // 2. Firma del contenido real. El navegador puede mentir con el MIME (lo
  //    deduce de la extensión), los bytes no.
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const firma = validarFirmaArchivo(bytes, formato);
  if (!firma.valido) {
    return { ok: false, error: firma.error ?? ERROR_GENERICO };
  }

  const nombre = entrada.nombre || archivo.name;
  // Solo se cuenta cuando puede influir: en modo puntual no hace falta.
  const existentes =
    entrada.modo === "biblioteca" ? await puertos.contarLogos(clienteId) : 0;
  const esPrincipal = decidirPrincipal(
    entrada.modo,
    entrada.esPrincipalSolicitado,
    existentes,
  );

  // 3. Ruta única y subida al bucket.
  const ruta = puertos.rutaNueva(clienteId, formato);
  const subida = await puertos.subirArchivo(ruta, bytes, formato);
  if (!subida.ok) {
    return {
      ok: false,
      error: "No se ha podido guardar el archivo. Revisa tu conexión.",
    };
  }

  // 4. Solo puede haber un principal por cliente (índice único parcial).
  if (esPrincipal) {
    const desmarcado = await puertos.desmarcarPrincipal(clienteId);
    if (!desmarcado) {
      await puertos.eliminarArchivo(ruta);
      return { ok: false, error: ERROR_GENERICO };
    }
  }

  // 5. Fila con todos los metadatos.
  const dimensiones = dimensionesDeImagen(bytes, formato);
  const logoId = await puertos.insertarFila({
    cliente_id: clienteId,
    nombre,
    storage_path: ruta,
    formato,
    tamano_bytes: archivo.size,
    ancho_px: dimensiones?.ancho ?? null,
    alto_px: dimensiones?.alto ?? null,
    es_principal: esPrincipal,
    subido_por: entrada.usuarioId,
    notas: entrada.notas,
  });

  if (!logoId) {
    // El archivo ya está en el bucket pero no hay fila que lo referencie:
    // se retira para no dejar huérfanos que nadie pueda ver ni borrar.
    await puertos.eliminarArchivo(ruta);
    return { ok: false, error: "No se ha podido guardar el logo." };
  }

  return { ok: true, logo_id: logoId, nombre, formato, es_principal: esPrincipal };
}
