-- F2.4 — Fotos reales de prendas (último prompt de Fase 2).
--
-- Crea la tabla `prendas_fotos` y las políticas RLS del bucket de Storage
-- `prendas-fotos`. El bucket en sí se crea con `npm run setup:prendas-fotos`
-- (scripts/setup_prendas_fotos_bucket.mjs): la API REST de Supabase no ejecuta
-- DDL, así que este archivo hay que aplicarlo a mano desde el SQL Editor.
--
-- Reparto de permisos: las fotos del catálogo son DATOS MAESTROS (como las
-- tarifas), no datos de cliente. Todos los roles las leen para pintar el
-- mockup; solo admin sube, reemplaza o borra.
--
-- Una foto por prenda y grupo de color (blanco / color / oscuro). La tabla no
-- lo impone para TODAS las filas —solo para la principal, con el índice único
-- parcial—, de modo que en el futuro se puedan guardar fotos alternativas sin
-- migrar. La aplicación hoy trabaja siempre con la principal.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table if not exists prendas_fotos (
  id uuid primary key default gen_random_uuid(),
  prenda_id uuid not null references prendas(id) on delete cascade,
  -- El enum del esquema inicial se llama `color_grupo` (sin sufijo _enum).
  color_grupo color_grupo not null,
  storage_path text not null,
  formato text not null check (formato in ('png', 'jpg', 'jpeg', 'webp')),
  tamano_bytes integer not null,
  ancho_px integer,
  alto_px integer,
  subido_por uuid references usuarios(id) on delete set null,
  subido_at timestamptz not null default now(),
  es_principal boolean not null default false
);

comment on table prendas_fotos is
  'Fotos reales de prendas del catálogo por color_grupo (blanco/color/oscuro).';

comment on column prendas_fotos.storage_path is
  'Ruta dentro del bucket prendas-fotos, con la forma {prenda_id}/{color_grupo}-{uuid}.{extension}';

create index if not exists idx_prendas_fotos_prenda_id
  on prendas_fotos (prenda_id);

-- Solo una foto principal por prenda y grupo de color.
create unique index if not exists uniq_foto_principal_por_prenda_color
  on prendas_fotos (prenda_id, color_grupo) where es_principal = true;

-- ---------------------------------------------------------------------------
-- RLS de la tabla
-- ---------------------------------------------------------------------------

alter table prendas_fotos enable row level security;

drop policy if exists prendas_fotos_select on prendas_fotos;
create policy prendas_fotos_select on prendas_fotos
  for select
  to authenticated
  using (public.get_user_rol() in ('admin', 'operador', 'consulta'));

drop policy if exists prendas_fotos_write on prendas_fotos;
create policy prendas_fotos_write on prendas_fotos
  for all
  to authenticated
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS del bucket `prendas-fotos`
-- ---------------------------------------------------------------------------
--
-- Defensa en profundidad, igual que `logos-clientes` (F2.1): la aplicación lee
-- y escribe el bucket con `service_role` tras comprobar el rol. Estas políticas
-- cubren el caso de una clave anónima filtrada.

drop policy if exists prendas_fotos_bucket_select on storage.objects;
create policy prendas_fotos_bucket_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'prendas-fotos'
    and public.get_user_rol() in ('admin', 'operador', 'consulta')
  );

drop policy if exists prendas_fotos_bucket_write on storage.objects;
create policy prendas_fotos_bucket_write on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'prendas-fotos'
    and public.get_user_rol() = 'admin'
  );

drop policy if exists prendas_fotos_bucket_delete on storage.objects;
create policy prendas_fotos_bucket_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'prendas-fotos'
    and public.get_user_rol() = 'admin'
  );
