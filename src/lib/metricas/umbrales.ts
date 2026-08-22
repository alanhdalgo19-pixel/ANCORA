// Umbrales del panel de métricas (Prompt 10).
//
// Viven en su propio archivo porque los comparten la capa de consultas (que los
// usa como prefiltro en SQL) y la función pura de agregación (que es donde se
// aplica el criterio definitivo). Tenerlos en un solo sitio evita que un futuro
// cambio de "20 días" deje las dos capas desalineadas.

/** Días desde la emisión a partir de los cuales un `enviado` se considera sin respuesta. */
export const DIAS_SIN_RESPUESTA = 20;

/** Días sin tocar a partir de los cuales un `borrador` se considera olvidado. */
export const DIAS_BORRADOR_OLVIDADO = 7;

/** Máximo de presupuestos que se listan en cada alerta. */
export const MAX_ITEMS_ALERTA = 10;

/** Nº de clientes que se muestran en cada sub-lista del top. */
export const TOP_CLIENTES = 5;
