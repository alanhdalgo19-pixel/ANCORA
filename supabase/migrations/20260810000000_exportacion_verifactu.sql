-- Prompt 9 — Exportación a Excel para la futura migración a Verifactu.
--
-- APLICAR MANUALMENTE desde el SQL Editor de Supabase, igual que las
-- migraciones 20260725000000 y 20260726000000: la API REST de Supabase no
-- ejecuta DDL.
--
-- ── Contexto ─────────────────────────────────────────────────────────
--
-- Ancora tiene que migrar de AON a un software de facturación conforme a
-- Verifactu antes de septiembre de 2026 (CLAUDE.md sección 1). Esta app NO
-- factura: exporta los presupuestos ACEPTADOS a un .xlsx que Ancora vuelca al
-- software que elija.
--
-- Para saber qué se ha volcado ya y qué no, cada presupuesto guarda la marca
-- de tiempo de la última exportación de facturación en la que apareció. Solo
-- se marcan los ACEPTADOS (la pestaña "Facturables" del Excel); borradores,
-- enviados, rechazados y caducados salen únicamente en la pestaña de análisis
-- y nunca se marcan.
--
-- Volver a exportar el mismo rango ACTUALIZA el timestamp: es la fecha del
-- último volcado, no la del primero. Un presupuesto ya marcado sigue saliendo
-- en el Excel; el flag informa, no filtra.

alter table presupuestos
  add column if not exists enviado_a_facturacion timestamptz;

comment on column presupuestos.enviado_a_facturacion is
  'Timestamp de la última exportación a Excel de facturación. Null si nunca se exportó.';

-- Consulta típica del panel: "aceptados del rango que aún no se han volcado".
create index if not exists idx_presupuestos_enviado_facturacion
  on presupuestos (enviado_a_facturacion);
