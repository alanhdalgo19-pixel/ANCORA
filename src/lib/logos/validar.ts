// F2.1 — validación de archivos de logo.
//
// Módulo puro: no importa Supabase ni Next. Se usa en los dos lados —
// · en el navegador (`SubirLogo.tsx`) para dar error inmediato sin subir nada,
// · en el servidor (Server Action) porque el navegador puede mentir: el tipo
//   MIME que llega en un `File` lo pone el sistema operativo a partir de la
//   extensión, así que renombrar `virus.exe` a `logo.png` lo cuela.
//
// De ahí las dos capas: `validarArchivoLogo` mira tamaño y MIME (rápido, buena
// UX) y `validarFirmaArchivo` mira los primeros bytes del contenido real
// (seguridad, solo servidor).

export const FORMATOS_PERMITIDOS = ["png", "jpg", "jpeg", "svg", "pdf"] as const;
export type FormatoLogo = (typeof FORMATOS_PERMITIDOS)[number];

export const TIPOS_MIME_PERMITIDOS = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
] as const;
export type TipoMimeLogo = (typeof TIPOS_MIME_PERMITIDOS)[number];

export const TAMANO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Nombres legibles para los mensajes de error de la interfaz. */
export const FORMATOS_LEGIBLES = "PNG, JPG, SVG, PDF";

const MIME_A_FORMATO: Record<string, FormatoLogo> = {
  "image/png": "png",
  // Se guarda siempre como "jpg": el check de la tabla admite "jpeg" por si
  // algún día entran datos de fuera, pero la aplicación normaliza a uno solo.
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

const FORMATO_A_MIME: Record<FormatoLogo, TipoMimeLogo> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

export interface ResultadoValidacion {
  valido: boolean;
  error?: string;
  formato?: FormatoLogo;
}

function esMimePermitido(mime: string): mime is TipoMimeLogo {
  return (TIPOS_MIME_PERMITIDOS as readonly string[]).includes(mime);
}

/** "png" → "image/png". Lo necesita la subida al bucket. */
export function mimeDeFormato(formato: FormatoLogo): TipoMimeLogo {
  return FORMATO_A_MIME[formato];
}

/** "image/jpeg" → "jpg". Devuelve null si el MIME no está permitido. */
export function mapMimeAFormato(mime: string): FormatoLogo | null {
  return MIME_A_FORMATO[mime] ?? null;
}

function megas(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * Primera capa: tamaño y tipo MIME declarado.
 * Se ejecuta en el navegador antes de subir y otra vez en el servidor.
 */
export function validarArchivoLogo(archivo: File): ResultadoValidacion {
  if (archivo.size === 0) {
    return { valido: false, error: "El archivo está vacío." };
  }

  if (archivo.size > TAMANO_MAX_BYTES) {
    return {
      valido: false,
      error:
        `El archivo es demasiado grande (${megas(archivo.size)} MB). ` +
        `El máximo permitido es ${megas(TAMANO_MAX_BYTES)} MB.`,
    };
  }

  if (!esMimePermitido(archivo.type)) {
    const tipo = archivo.type || "desconocido";
    return {
      valido: false,
      error: `Formato no soportado (${tipo}). Formatos permitidos: ${FORMATOS_LEGIBLES}.`,
    };
  }

  return { valido: true, formato: mapMimeAFormato(archivo.type) ?? undefined };
}

// ---------------------------------------------------------------------------
// Segunda capa: firma del contenido (magic number)
// ---------------------------------------------------------------------------

const ERROR_FIRMA =
  "El archivo parece dañado o el formato no coincide con la extensión.";

function empiezaPor(bytes: Uint8Array, firma: readonly number[]): boolean {
  if (bytes.length < firma.length) return false;
  return firma.every((byte, indice) => bytes[indice] === byte);
}

/** Los primeros `limite` bytes decodificados como texto, sin BOM ni espacios. */
function cabeceraDeTexto(bytes: Uint8Array, limite = 4096): string {
  const trozo = bytes.subarray(0, limite);
  let texto = new TextDecoder("utf-8", { fatal: false }).decode(trozo);
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  return texto.trimStart();
}

// Un SVG legítimo puede empezar por la declaración XML, por comentarios, por un
// DOCTYPE o directamente por la etiqueta raíz. Se aceptan esos cuatro arranques
// y además se exige que `<svg` aparezca en la cabecera: así no cuela cualquier
// XML ni un HTML con extensión cambiada.
const ARRANQUES_SVG = ["<?xml", "<svg", "<!--", "<!doctype"] as const;

function pareceSvg(bytes: Uint8Array): boolean {
  const cabecera = cabeceraDeTexto(bytes);
  const minusculas = cabecera.toLowerCase();
  const arranqueValido = ARRANQUES_SVG.some((inicio) =>
    minusculas.startsWith(inicio),
  );
  return arranqueValido && minusculas.includes("<svg");
}

/**
 * Segunda capa: comprueba que el contenido real es del formato declarado.
 * Solo se ejecuta en el servidor, donde ya tenemos los bytes del archivo.
 */
export function validarFirmaArchivo(
  bytes: Uint8Array,
  formato: FormatoLogo,
): { valido: boolean; error?: string } {
  const coincide = (() => {
    switch (formato) {
      case "png":
        // 89 50 4E 47 → \x89PNG
        return empiezaPor(bytes, [0x89, 0x50, 0x4e, 0x47]);
      case "jpg":
      case "jpeg":
        // FF D8 FF → SOI + primer marcador
        return empiezaPor(bytes, [0xff, 0xd8, 0xff]);
      case "pdf":
        // 25 50 44 46 → %PDF
        return empiezaPor(bytes, [0x25, 0x50, 0x44, 0x46]);
      case "svg":
        return pareceSvg(bytes);
    }
  })();

  return coincide ? { valido: true } : { valido: false, error: ERROR_FIRMA };
}

// ---------------------------------------------------------------------------
// Dimensiones en píxeles
// ---------------------------------------------------------------------------
//
// Se leen de la cabecera del archivo, sin librerías: son datos que F2.2
// necesitará para escalar el logo sobre la prenda y aquí salen gratis.
// Solo PNG y JPG: en SVG y PDF las medidas son unidades de documento (mm, pt,
// viewBox), no píxeles, y traducirlas es trabajo de F2.2.

export interface DimensionesImagen {
  ancho: number;
  alto: number;
}

function leerUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function dimensionesPng(bytes: Uint8Array): DimensionesImagen | null {
  // Firma (8) + longitud del chunk (4) + "IHDR" (4) → ancho en 16, alto en 20.
  if (bytes.length < 24) return null;
  const ancho = leerUint32BE(bytes, 16);
  const alto = leerUint32BE(bytes, 20);
  return ancho > 0 && alto > 0 ? { ancho, alto } : null;
}

// Marcadores SOF (Start Of Frame) que llevan las dimensiones. Se excluyen
// C4 (tablas Huffman), C8 (extensión JPEG) y CC (aritmética): comparten el
// rango pero no son SOF.
const MARCADORES_SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function dimensionesJpg(bytes: Uint8Array): DimensionesImagen | null {
  let i = 2; // se salta el SOI (FF D8)
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1; // relleno entre segmentos
      continue;
    }
    const marcador = bytes[i + 1];
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    if (MARCADORES_SOF.has(marcador)) {
      // FF, marcador, longitud (2), precisión (1), alto (2), ancho (2)
      const alto = (bytes[i + 5] << 8) | bytes[i + 6];
      const ancho = (bytes[i + 7] << 8) | bytes[i + 8];
      return ancho > 0 && alto > 0 ? { ancho, alto } : null;
    }
    const longitud = (bytes[i + 2] << 8) | bytes[i + 3];
    if (longitud < 2) return null; // segmento corrupto
    i += 2 + longitud;
  }
  return null;
}

/** Dimensiones en píxeles, o null si el formato no las expone o no se pueden leer. */
export function dimensionesDeImagen(
  bytes: Uint8Array,
  formato: FormatoLogo,
): DimensionesImagen | null {
  switch (formato) {
    case "png":
      return dimensionesPng(bytes);
    case "jpg":
    case "jpeg":
      return dimensionesJpg(bytes);
    default:
      return null;
  }
}
