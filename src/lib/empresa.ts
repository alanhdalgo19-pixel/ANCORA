// Datos fiscales de Ancora y textos fijos del presupuesto (CLAUDE.md 1 y 7.9).
//
// Confirmados por el usuario en el Prompt 7 a partir de los presupuestos
// históricos de Ancora. El único campo que sigue a `null` es el email: no está
// confirmado con Espe y, al ser opcional en un presupuesto, la línea
// simplemente se omite del documento en vez de imprimir un "PENDIENTE" que
// acabaría delante del cliente. Ver CLAUDE.md sección 10 (pendientes).

export interface DatosEmpresa {
  razon_social: string;
  nombre_comercial: string;
  nif: string;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string;
  provincia: string;
  telefono: string | null;
  email: string | null;
  iban: string | null;
  banco: string | null;
}

export const EMPRESA: DatosEmpresa = {
  razon_social: "Andes Publicitat, S.L.",
  nombre_comercial: "Ancora Publicitat",
  nif: "B57326928",
  direccion: "C/ Blatera 37 B",
  codigo_postal: "07198",
  localidad: "Son Ferriol",
  provincia: "Illes Balears",
  telefono: "971 428 072",
  // PENDIENTE: confirmar con Espe el email de contacto comercial de Ancora.
  // Mientras sea null, la línea no aparece ni en el preview ni en el PDF.
  email: null,
  iban: "ES84 2100 6328 9513 0008 6685",
  banco: "LA CAIXA",
};

/**
 * Campos obligatorios de `EMPRESA` que aún faltan, para el aviso del preview.
 *
 * El email queda fuera a propósito: es opcional en un presupuesto y su ausencia
 * no invalida el documento, así que no debe disparar el aviso ámbar. Los demás
 * campos sí son fiscalmente necesarios; la función se mantiene por si alguno
 * volviera a quedarse vacío en el futuro.
 */
export function datosEmpresaPendientes(): string[] {
  const pendientes: string[] = [];
  if (!EMPRESA.direccion) pendientes.push("dirección");
  if (!EMPRESA.codigo_postal) pendientes.push("código postal");
  if (!EMPRESA.telefono) pendientes.push("teléfono");
  if (!EMPRESA.iban) pendientes.push("IBAN");
  return pendientes;
}

/**
 * Las 5 notas estándar del pie del presupuesto (CLAUDE.md 7.9).
 * Viven aquí como constante hasta que el panel admin las haga editables.
 */
export const NOTAS_ESTANDAR: string[] = [
  "El logotipo debe facilitarse en formato vectorial (.ai, .eps, .pdf o .svg). Si no se dispone de él, se presupuesta la vectorización aparte.",
  "Este presupuesto tiene una validez de 30 días desde la fecha de emisión.",
  "Los precios indicados corresponden exclusivamente a las cantidades presupuestadas. Cualquier variación de cantidad modifica el precio unitario.",
  "Forma de pago: 50% a la confirmación del pedido y 50% antes de la entrega.",
  "Ancora no se responsabiliza de los desperfectos ocasionados sobre materiales o prendas aportados por el cliente.",
];

export const FORMA_PAGO_RESUMEN =
  "50% a la confirmación del pedido · 50% antes de la entrega";

/** Días de validez por defecto de un presupuesto nuevo (CLAUDE.md 6.3). */
export const DIAS_VALIDEZ_PRESUPUESTO = 30;

/**
 * Primer número de presupuesto que emite el sistema en 2026.
 * Ancora iba por el ~88 en su software anterior (CLAUDE.md 7.7); arrancamos en
 * 90 para dejar margen. Ajustable cuando Espe confirme el número exacto.
 */
export const PRIMER_NUMERO_2026 = 90;
