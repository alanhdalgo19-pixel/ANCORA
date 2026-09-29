-- F2.3 — Tipo de prenda para el mockup (CLAUDE.md, nota crítica 28, opción A).
--
-- El componente Mockup (F2.2) necesita saber si una prenda es polo, camiseta,
-- sudadera… para elegir sus dimensiones y áreas imprimibles. El dato es
-- estable (una prenda no cambia de tipo), así que vive en el catálogo y no se
-- le pregunta a Sonia en cada línea.
--
-- Sin valor por defecto: se acepta null para prendas antiguas o nuevas sin
-- clasificar, que el mockup pinta como "otro". El relleno inicial de las 13
-- prendas top lo hace `node scripts/rellenar_tipo_mockup.mjs`.
--
-- La API REST de Supabase no ejecuta DDL: aplicar a mano desde el SQL Editor.
-- Idempotente: se puede ejecutar más de una vez sin error.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_mockup_enum') then
    create type tipo_mockup_enum as enum (
      'polo', 'camiseta', 'sudadera', 'chaleco', 'delantal', 'toalla', 'otro'
    );
  end if;
end $$;

alter table prendas
  add column if not exists tipo_mockup tipo_mockup_enum;

comment on column prendas.tipo_mockup is
  'Tipo de prenda para el componente Mockup. Null = usar "otro" por defecto.';

create index if not exists idx_prendas_tipo_mockup
  on prendas (tipo_mockup) where tipo_mockup is not null;
