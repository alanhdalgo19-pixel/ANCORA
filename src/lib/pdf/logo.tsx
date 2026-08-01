// Logo de Ancora para el PDF de presupuesto.
//
// Logo oficial facilitado por Ancora en el Patch 7A: `public/logo-ancora.png`
// (569×158 px, PNG con transparencia). Sustituye al placeholder provisional —
// disco azul-cyan con la inicial — que se usó hasta el Prompt 7.
//
// El PNG contiene la marca completa ("ANCORA" con el rombo CMYK + "PUBLICITAT"),
// así que la cabecera del PDF ya no imprime el nombre comercial como texto: lo
// pone el propio logo. Sigue pendiente el original vectorial (CLAUDE.md sección
// 10, pendiente 23): un SVG no lo aceptaría `Image` de @react-pdf/renderer, pero
// permitiría exportar un PNG a más resolución si algún día se ve pixelado.
//
// Para cambiar el logo basta con reemplazar el archivo de `public/`; nadie más
// conoce esta implementación.

import fs from "node:fs";
import path from "node:path";
import { Image } from "@react-pdf/renderer";

/** Proporción del PNG oficial (569 × 158). Fija el alto a partir del ancho. */
const RATIO_LOGO = 158 / 569;

export const RUTA_LOGO = path.join(process.cwd(), "public", "logo-ancora.png");

let cacheLogo: Buffer | null = null;

/**
 * Lee el PNG del disco una sola vez por proceso.
 *
 * `Image` de @react-pdf/renderer no descarga URLs relativas: en el servidor
 * necesita el binario. Se lee de forma perezosa (no al importar el módulo) para
 * que un despliegue con el archivo ausente falle al generar un PDF concreto y
 * no al arrancar la aplicación entera.
 *
 * Nota de despliegue: `next.config.mjs` incluye este archivo en
 * `outputFileTracingIncludes` para que Vercel lo empaquete en la función que
 * genera el PDF (los assets de `public/` van al CDN, no al sistema de archivos
 * de la lambda).
 */
function leerLogo(): Buffer {
  if (!cacheLogo) {
    cacheLogo = fs.readFileSync(RUTA_LOGO);
  }
  return cacheLogo;
}

interface LogoAncoraProps {
  /** Ancho en puntos. 130 pt ≈ 46 mm, la cabecera del presupuesto. */
  ancho?: number;
}

export function LogoAncora({ ancho = 130 }: LogoAncoraProps) {
  return (
    // `Image` es el primitivo de @react-pdf/renderer, no un <img> de HTML: no
    // admite `alt`. Un PDF no tiene texto alternativo por elemento; la
    // accesibilidad va por el texto del documento, que ya nombra a Ancora en
    // el bloque "DE".
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      src={{ data: leerLogo(), format: "png" }}
      style={{ width: ancho, height: ancho * RATIO_LOGO }}
    />
  );
}
