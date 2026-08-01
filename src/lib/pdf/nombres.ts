// Nombres de archivo y rutas del PDF de presupuesto.
//
// Módulo puro, separado de `storage.ts` a propósito: `storage.ts` importa el
// cliente `service_role` y por tanto no puede acabar en el grafo de un
// componente de cliente. Los botones de descarga solo necesitan el nombre del
// archivo, así que importan de aquí.

/** `2026/000090/0` → `2026-000090-0` (las barras no valen en un nombre). */
export function numeroParaArchivo(numero: string): string {
  return numero.replace(/\//g, "-");
}

/** Nombre con el que el navegador descarga el PDF. */
export function nombreArchivoPDF(numero: string): string {
  return `Ancora_Presupuesto_${numeroParaArchivo(numero)}.pdf`;
}

/**
 * Ruta dentro del bucket: `{año}/Ancora_Presupuesto_{numero}.pdf`.
 * El año sale de la propia numeración (CLAUDE.md 7.7), que ya lo lleva delante.
 */
export function rutaStoragePDF(numero: string): string {
  const anio = numero.split("/")[0] || String(new Date().getFullYear());
  return `${anio}/${nombreArchivoPDF(numero)}`;
}
