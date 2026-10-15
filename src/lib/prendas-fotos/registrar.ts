// F2.4 — núcleo de la subida y el reemplazo de la foto de una prenda.
//
// Mismo patrón que `@/lib/logos/registrar` (F2.3): todo lo que toca base de
// datos o Storage entra por `PuertosFotoPrenda`, que en producción implementan
// las Server Actions y en los tests un doble en memoria. A diferencia de los
// logos, la comprobación de rol SÍ vive aquí: las fotos del catálogo son datos
// maestros y solo admin las toca, sin matices por pantalla. La Server Action
// pasa el rol leído de la sesión y el núcleo decide.
//
// Reemplazar NO borra la fila: la actualiza en sitio (ruta, formato, tamaño,
// dimensiones) y después retira el objeto viejo. Así no hay ningún instante en
// que la prenda se quede sin foto, y si el UPDATE falla la foto anterior sigue
// intacta. El id de la fila se conserva; `/api/prendas-fotos/{id}` firma cada
// vez la ruta nueva, así que no hay riesgo de servir la imagen antigua.

import type { ColorGrupo, Rol } from "@/types/database";
import {
  dimensionesDeFoto,
  validarArchivoFoto,
  validarFirmaFoto,
  type FormatoFoto,
} from "./validar";

export interface FotoExistente {
  id: string;
  storage_path: string;
}

export interface FilaNuevaFoto {
  prenda_id: string;
  color_grupo: ColorGrupo;
  storage_path: string;
  formato: FormatoFoto;
  tamano_bytes: number;
  ancho_px: number | null;
  alto_px: number | null;
  subido_por: string;
  es_principal: true;
}

export type CambiosFoto = Omit<FilaNuevaFoto, "prenda_id" | "color_grupo" | "es_principal">;

export interface PuertosFotoPrenda {
  /** La foto principal de esa prenda y color, si la hay. */
  fotoPrincipal: (prendaId: string, color: ColorGrupo) => Promise<FotoExistente | null>;
  rutaNueva: (prendaId: string, color: ColorGrupo, formato: FormatoFoto) => string;
  subirArchivo: (
    ruta: string,
    contenido: Uint8Array,
    formato: FormatoFoto,
  ) => Promise<boolean>;
  eliminarArchivo: (ruta: string) => Promise<boolean>;
  insertarFila: (fila: FilaNuevaFoto) => Promise<string | null>;
  actualizarFila: (id: string, cambios: CambiosFoto) => Promise<boolean>;
}

export interface EntradaFotoPrenda {
  rol: Rol | null;
  usuarioId: string;
  prendaId: string;
  colorGrupo: ColorGrupo;
  archivo: File;
  /** "subir" exige el hueco libre; "reemplazar" exige que haya foto. */
  modo: "subir" | "reemplazar";
}

export type ResultadoFotoPrenda =
  | { ok: true; foto_id: string }
  | { ok: false; error: string };

export const ERROR_PERMISO_FOTOS =
  "Solo un administrador puede gestionar las fotos de las prendas.";

const COLORES: ColorGrupo[] = ["blanco", "color", "oscuro"];

export function esColorGrupo(valor: unknown): valor is ColorGrupo {
  return typeof valor === "string" && (COLORES as string[]).includes(valor);
}

export async function registrarFotoPrenda(
  puertos: PuertosFotoPrenda,
  entrada: EntradaFotoPrenda,
): Promise<ResultadoFotoPrenda> {
  if (entrada.rol !== "admin") {
    return { ok: false, error: ERROR_PERMISO_FOTOS };
  }
  if (!esColorGrupo(entrada.colorGrupo)) {
    return { ok: false, error: "Grupo de color no válido." };
  }

  // 1. Tamaño y MIME declarado.
  const validacion = validarArchivoFoto(entrada.archivo);
  if (!validacion.valido || !validacion.formato) {
    return { ok: false, error: validacion.error ?? "No se puede usar este archivo." };
  }
  const formato = validacion.formato;

  // 2. Firma real del contenido.
  const bytes = new Uint8Array(await entrada.archivo.arrayBuffer());
  const firma = validarFirmaFoto(bytes, formato);
  if (!firma.valido) {
    return { ok: false, error: firma.error ?? "El archivo parece dañado." };
  }

  // 3. Estado del hueco (prenda + color).
  const existente = await puertos.fotoPrincipal(entrada.prendaId, entrada.colorGrupo);
  if (entrada.modo === "subir" && existente) {
    return {
      ok: false,
      error: "Esta prenda ya tiene foto para ese color. Usa «Reemplazar».",
    };
  }
  if (entrada.modo === "reemplazar" && !existente) {
    return { ok: false, error: "No hay ninguna foto que reemplazar." };
  }

  // 4. Subida del archivo nuevo (siempre ruta nueva, sin upsert).
  const ruta = puertos.rutaNueva(entrada.prendaId, entrada.colorGrupo, formato);
  const subido = await puertos.subirArchivo(ruta, bytes, formato);
  if (!subido) {
    return { ok: false, error: "No se ha podido guardar la foto. Revisa tu conexión." };
  }

  const dimensiones = dimensionesDeFoto(bytes, formato);
  const datos: CambiosFoto = {
    storage_path: ruta,
    formato,
    tamano_bytes: entrada.archivo.size,
    ancho_px: dimensiones?.ancho ?? null,
    alto_px: dimensiones?.alto ?? null,
    subido_por: entrada.usuarioId,
  };

  // 5a. Reemplazo: la fila apunta al archivo nuevo y el viejo se retira.
  if (existente) {
    const actualizado = await puertos.actualizarFila(existente.id, datos);
    if (!actualizado) {
      await puertos.eliminarArchivo(ruta);
      return { ok: false, error: "No se ha podido reemplazar la foto." };
    }
    const borrado = await puertos.eliminarArchivo(existente.storage_path);
    if (!borrado) {
      console.error(
        `[prendas-fotos] foto ${existente.id} reemplazada pero ${existente.storage_path} sigue en el bucket`,
      );
    }
    return { ok: true, foto_id: existente.id };
  }

  // 5b. Alta.
  const fotoId = await puertos.insertarFila({
    ...datos,
    prenda_id: entrada.prendaId,
    color_grupo: entrada.colorGrupo,
    es_principal: true,
  });
  if (!fotoId) {
    // Sin fila que lo referencie, el archivo sería un huérfano invisible.
    await puertos.eliminarArchivo(ruta);
    return { ok: false, error: "No se ha podido guardar la foto." };
  }

  return { ok: true, foto_id: fotoId };
}
