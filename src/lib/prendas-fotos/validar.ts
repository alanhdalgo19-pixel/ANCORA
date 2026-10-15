// F2.4 — validación de las fotos de prenda del catálogo.
//
// Mismas dos capas que los logos (F2.1, `@/lib/logos/validar`):
// · `validarArchivoFoto` — tamaño y MIME declarado (navegador y servidor).
// · `validarFirmaFoto`   — primeros bytes del contenido (solo servidor).
//
// Diferencias con los logos: aquí solo hay fotos raster (PNG, JPG, WebP; nada
// de SVG ni PDF) y el tope es 3 MB —una foto de catálogo no necesita más y el
// mockup se pinta a ~360 px de alto—. PNG y JPG reutilizan la firma y la
// lectura de dimensiones de los logos; WebP es nuevo y se lee aquí.
//
// Módulo puro: sin Supabase ni Next.

import {
  dimensionesDeImagen,
  validarFirmaArchivo,
  type DimensionesImagen,
} from "@/lib/logos/validar";

export const FORMATOS_FOTO = ["png", "jpg", "jpeg", "webp"] as const;
export type FormatoFoto = (typeof FORMATOS_FOTO)[number];

export const TIPOS_MIME_FOTO = ["image/png", "image/jpeg", "image/webp"] as const;
type TipoMimeFoto = (typeof TIPOS_MIME_FOTO)[number];

export const TAMANO_MAX_FOTO_BYTES = 3 * 1024 * 1024; // 3 MB

export const FORMATOS_FOTO_LEGIBLES = "PNG, JPG, WebP";

const MIME_A_FORMATO: Record<TipoMimeFoto, FormatoFoto> = {
  "image/png": "png",
  // Se normaliza a "jpg", igual que en los logos.
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const FORMATO_A_MIME: Record<FormatoFoto, TipoMimeFoto> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function mimeDeFormatoFoto(formato: FormatoFoto): TipoMimeFoto {
  return FORMATO_A_MIME[formato];
}

export function esFormatoFoto(valor: unknown): valor is FormatoFoto {
  return (
    typeof valor === "string" &&
    (FORMATOS_FOTO as readonly string[]).includes(valor)
  );
}

function esMimeFoto(mime: string): mime is TipoMimeFoto {
  return (TIPOS_MIME_FOTO as readonly string[]).includes(mime);
}

function megas(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export interface ResultadoValidacionFoto {
  valido: boolean;
  error?: string;
  formato?: FormatoFoto;
}

/** Primera capa: tamaño y tipo MIME declarado. */
export function validarArchivoFoto(archivo: File): ResultadoValidacionFoto {
  if (archivo.size === 0) {
    return { valido: false, error: "El archivo está vacío." };
  }

  if (archivo.size > TAMANO_MAX_FOTO_BYTES) {
    return {
      valido: false,
      error:
        `La foto es demasiado grande (${megas(archivo.size)} MB). ` +
        `El máximo permitido es ${megas(TAMANO_MAX_FOTO_BYTES)} MB.`,
    };
  }

  if (!esMimeFoto(archivo.type)) {
    const tipo = archivo.type || "desconocido";
    return {
      valido: false,
      error: `Formato no soportado (${tipo}). Formatos permitidos: ${FORMATOS_FOTO_LEGIBLES}.`,
    };
  }

  return { valido: true, formato: MIME_A_FORMATO[archivo.type] };
}

// ---------------------------------------------------------------------------
// WebP: contenedor RIFF
// ---------------------------------------------------------------------------
//
// "RIFF" (4) + tamaño (4) + "WEBP" (4) + primer chunk: "VP8 " (con pérdida),
// "VP8L" (sin pérdida) o "VP8X" (extendido: transparencia, animación…).

function ascii(bytes: Uint8Array, desde: number, largo: number): string {
  return String.fromCharCode(...Array.from(bytes.subarray(desde, desde + largo)));
}

function esWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 16 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  );
}

function dimensionesWebp(bytes: Uint8Array): DimensionesImagen | null {
  if (!esWebp(bytes) || bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);

  let ancho = 0;
  let alto = 0;
  if (chunk === "VP8X") {
    // Ancho-1 y alto-1 en 24 bits little-endian.
    ancho = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    alto = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
  } else if (chunk === "VP8L") {
    // Firma 0x2F y luego 14 bits de ancho-1 + 14 bits de alto-1.
    if (bytes[20] !== 0x2f) return null;
    const [b0, b1, b2, b3] = [bytes[21], bytes[22], bytes[23], bytes[24]];
    ancho = 1 + (((b1 & 0x3f) << 8) | b0);
    alto = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
  } else if (chunk === "VP8 ") {
    // Cabecera de fotograma (3) + código de inicio 9D 01 2A + 14 bits por eje.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    ancho = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    alto = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
  } else {
    return null;
  }

  return ancho > 0 && alto > 0 ? { ancho, alto } : null;
}

const ERROR_FIRMA =
  "El archivo parece dañado o el formato no coincide con la extensión.";

/** Segunda capa: el contenido real es del formato declarado. Solo servidor. */
export function validarFirmaFoto(
  bytes: Uint8Array,
  formato: FormatoFoto,
): { valido: boolean; error?: string } {
  if (formato === "webp") {
    return esWebp(bytes) ? { valido: true } : { valido: false, error: ERROR_FIRMA };
  }
  return validarFirmaArchivo(bytes, formato);
}

/** Dimensiones en píxeles leídas de la cabecera, o null si no se pueden leer. */
export function dimensionesDeFoto(
  bytes: Uint8Array,
  formato: FormatoFoto,
): DimensionesImagen | null {
  if (formato === "webp") return dimensionesWebp(bytes);
  return dimensionesDeImagen(bytes, formato);
}
