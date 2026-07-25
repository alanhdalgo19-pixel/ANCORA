-- Preparación del wizard de presupuesto (Prompt 6).
--
-- El esquema inicial ya cubre casi todo lo que necesita el wizard: los campos
-- de `presupuestos` y `lineas_presupuesto` de CLAUDE.md sección 6.3 están
-- completos. Faltan dos cosas:
--
--   1. Poder relacionar una línea 'extra' (picaje, fotolitos, vectorización,
--      pantones) con la línea de técnica que la generó. Sin ese vínculo, al
--      eliminar una línea de bordado sus extras quedarían huérfanos en el
--      presupuesto y habría que adivinar cuáles borrar.
--
--   2. Permiso de DELETE para el rol `operador`. La migración de RLS
--      (20260718000000) dio a operador SELECT/INSERT/UPDATE sobre
--      `lineas_presupuesto`, pero no DELETE, así que Sonia no podría borrar una
--      línea equivocada de su propio borrador. `admin` ya tiene ALL.

-- ── 1. Vínculo extra → línea de técnica ──────────────────────────────

alter table lineas_presupuesto
  add column linea_padre_id uuid references lineas_presupuesto (id) on delete cascade;

comment on column lineas_presupuesto.linea_padre_id is
  'Solo en líneas de tipo ''extra'': apunta a la línea de técnica que las generó. ON DELETE CASCADE borra los extras al borrar su línea.';

create index lineas_presupuesto_linea_padre_id_idx
  on lineas_presupuesto (linea_padre_id);

-- ── 2. DELETE para operador sobre las líneas de presupuesto ──────────

create policy lineas_presupuesto_operador_delete on lineas_presupuesto
  for delete
  using (public.get_user_rol() = 'operador');

-- ── 3. Índice para el listado de presupuestos ────────────────────────
--
-- El listado ordena por fecha de emisión descendente y filtra por estado.

create index presupuestos_fecha_emision_idx
  on presupuestos (fecha_emision desc);
