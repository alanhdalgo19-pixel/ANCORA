// Paleta y hoja de estilos del PDF de presupuesto (CLAUDE.md 7.9 y 8).
//
// @react-pdf/renderer no entiende Tailwind: trabaja con un StyleSheet propio
// en puntos tipográficos (1 pt = 1/72"). Los valores replican la identidad
// visual de la sección 8 y el preview HTML (`PresupuestoPreview.tsx`), que es
// la referencia de maquetación.

import { StyleSheet } from "@react-pdf/renderer";

export const COLOR = {
  primary: "#0c8aa3",
  primaryLight: "#E6F4F7",
  textPrimary: "#1a1a1a",
  textSecondary: "#5a5a5a",
  textTertiary: "#8a8a8a",
  border: "#e0e0e0",
  borderStrong: "#d4d4d4",
  bgSuave: "#fafafa",
  danger: "#C62828",
  warning: "#B68900",
} as const;

/** Anchos de las columnas de la tabla de líneas (deben sumar 100%). */
export const COLUMNAS = {
  descripcion: "55%",
  cantidad: "12%",
  precio: "14%",
  importe: "19%",
} as const;

export const estilos = StyleSheet.create({
  // ── Página ─────────────────────────────────────────────────────────
  page: {
    // 20 mm ≈ 56.7 pt.
    padding: 56.7,
    paddingBottom: 58,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.textPrimary,
    lineHeight: 1.4,
  },

  // ── Cabecera ───────────────────────────────────────────────────────
  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: 14,
  },
  cabeceraIzquierda: {
    // El logo oficial ya incluye el rótulo "ANCORA PUBLICITAT", así que la
    // localidad va debajo en columna en vez de al lado de una marca dibujada.
    flexDirection: "column",
    gap: 4,
  },
  cabeceraDerecha: {
    alignItems: "flex-end",
  },
  titulo: {
    fontFamily: "Helvetica-Bold",
    // 18 pt en vez de 22: con 22 el bloque del título comía el espacio del
    // número y ambos se solapaban (CLAUDE.md 13.8 punto 1).
    fontSize: 18,
    letterSpacing: 2,
    color: COLOR.textPrimary,
    // `lineHeight` explícito: sin él la caja de línea del título depende del
    // valor heredado de `page` y el número se pintaba encima de la última letra.
    lineHeight: 1.2,
  },
  numero: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: COLOR.primary,
    lineHeight: 1.2,
    marginTop: 6,
  },

  // ── Badges ─────────────────────────────────────────────────────────
  bandaBadges: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },
  gruposBadges: {
    flexDirection: "row",
    gap: 5,
  },
  badge: {
    borderWidth: 1,
    borderColor: COLOR.borderStrong,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: COLOR.textSecondary,
  },
  badgePrimario: {
    borderColor: COLOR.primary,
    backgroundColor: COLOR.primaryLight,
    color: COLOR.primary,
  },
  badgeAviso: {
    borderColor: COLOR.danger,
    color: COLOR.danger,
  },

  // ── Bloques DE / PARA ──────────────────────────────────────────────
  bloquesDePara: {
    flexDirection: "row",
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingVertical: 10,
  },
  columna: {
    width: "50%",
  },
  epigrafe: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1,
    color: COLOR.textTertiary,
    marginBottom: 5,
  },

  // ── Comentario ─────────────────────────────────────────────────────
  comentario: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingVertical: 8,
    color: COLOR.textSecondary,
  },

  // ── Tabla de líneas ────────────────────────────────────────────────
  tabla: {
    marginTop: 12,
  },
  filaCabecera: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderStrong,
    paddingBottom: 4,
  },
  celdaCabecera: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLOR.textSecondary,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.border,
    paddingVertical: 4,
  },
  celdaDerecha: {
    textAlign: "right",
  },
  descripcionExtra: {
    color: COLOR.textSecondary,
    paddingLeft: 10,
  },
  subdescripcion: {
    fontSize: 7.5,
    color: COLOR.textTertiary,
    marginTop: 1.5,
  },
  /** Un logo de una línea DTF compuesta (Prompt 8). */
  sublineaLogo: {
    fontSize: 8,
    color: COLOR.textSecondary,
    paddingLeft: 10,
    marginTop: 1.5,
  },
  sinLineas: {
    paddingVertical: 18,
    textAlign: "center",
    color: COLOR.textTertiary,
  },

  // ── Totales ────────────────────────────────────────────────────────
  zonaTotales: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totales: {
    width: 200,
  },
  filaTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  filaBase: {
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    marginTop: 3,
    paddingTop: 4,
  },
  filaTotalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLOR.borderStrong,
    marginTop: 5,
    paddingTop: 5,
  },
  etiquetaTotal: {
    color: COLOR.textSecondary,
  },
  etiquetaTotalFinal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: COLOR.textPrimary,
  },
  importeTotalFinal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: COLOR.primary,
  },

  // ── Notas, pago y firma ────────────────────────────────────────────
  notas: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: COLOR.bgSuave,
    borderRadius: 4,
    padding: 10,
  },
  nota: {
    flexDirection: "row",
    marginBottom: 3,
  },
  notaIndice: {
    width: 12,
    fontSize: 7.5,
    color: COLOR.textTertiary,
  },
  notaTexto: {
    flex: 1,
    fontSize: 7.5,
    color: COLOR.textSecondary,
  },
  pieBloques: {
    flexDirection: "row",
    gap: 24,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
    paddingTop: 12,
  },
  lineaFirma: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: COLOR.borderStrong,
    paddingTop: 3,
  },

  // ── Textos auxiliares ──────────────────────────────────────────────
  negrita: {
    fontFamily: "Helvetica-Bold",
  },
  atenuado: {
    color: COLOR.textSecondary,
  },
  tenue: {
    color: COLOR.textTertiary,
    fontSize: 7.5,
  },
  paginacion: {
    position: "absolute",
    bottom: 22,
    left: 56.7,
    right: 56.7,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLOR.textTertiary,
  },
});
