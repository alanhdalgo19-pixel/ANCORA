-- F2.1 — Biblioteca de logos por cliente (primer prompt de Fase 2).
--
-- Crea la tabla `logos_clientes` y las políticas RLS del bucket de Storage
-- `logos-clientes`. El bucket en sí se crea con `npm run setup:logos`
-- (scripts/setup_logos_bucket.mjs): la API REST de Supabase no ejecuta DDL,
-- así que este archivo hay que aplicarlo a mano desde el SQL Editor.
--
-- Reparto de permisos (más restrictivo que el resto de tablas a propósito):
--   · consulta → solo lectura.
--   · operador → lee, sube y actualiza, pero NO borra.
--   · admin    → todo, incluido borrar.
-- Motivo: los logos son propiedad del cliente. Borrar uno por error obliga a
-- pedírselo otra vez, así que el borrado se reserva a admin.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table if not exists logos_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  storage_path text not null,
  formato text not null check (formato in ('png', 'jpg', 'jpeg', 'svg', 'pdf')),
  tamano_bytes integer not null,
  ancho_px integer,
  alto_px integer,
  es_principal boolean not null default false,
  subido_por uuid references usuarios(id) on delete set null,
  subido_at timestamptz not null default now(),
  notas text
);

comment on table logos_clientes is
  'Biblioteca de logos por cliente. Un cliente puede tener 0-N logos guardados para reutilizar en presupuestos.';

comment on column logos_clientes.es_principal is
  'Si true, es el logo por defecto que se sugiere primero al crear presupuestos para este cliente.';

comment on column logos_clientes.storage_path is
  'Ruta dentro del bucket logos-clientes, con la forma {cliente_id}/{uuid}.{extension}';

create index if not exists idx_logos_clientes_cliente_id
  on logos_clientes (cliente_id);

create index if not exists idx_logos_clientes_principal
  on logos_clientes (cliente_id, es_principal) where es_principal = true;

-- Solo un logo puede ser principal por cliente
create unique index if not exists uniq_logo_principal_por_cliente
  on logos_clientes (cliente_id) where es_principal = true;

-- ---------------------------------------------------------------------------
-- RLS de la tabla
-- ---------------------------------------------------------------------------

alter table logos_clientes enable row level security;

drop policy if exists logos_clientes_select on logos_clientes;
create policy logos_clientes_select on logos_clientes
  for select
  to authenticated
  using (public.get_user_rol() in ('admin', 'operador', 'consulta'));

drop policy if exists logos_clientes_insert on logos_clientes;
create policy logos_clientes_insert on logos_clientes
  for insert
  to authenticated
  with check (public.get_user_rol() in ('admin', 'operador'));

drop policy if exists logos_clientes_update on logos_clientes;
create policy logos_clientes_update on logos_clientes
  for update
  to authenticated
  using (public.get_user_rol() in ('admin', 'operador'))
  with check (public.get_user_rol() in ('admin', 'operador'));

drop policy if exists logos_clientes_delete on logos_clientes;
create policy logos_clientes_delete on logos_clientes
  for delete
  to authenticated
  using (public.get_user_rol() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS del bucket `logos-clientes`
-- ---------------------------------------------------------------------------
--
-- Defensa en profundidad, igual que en el bucket `presupuestos-pdf`
-- (migración 20260726000000): la aplicación NO abre el bucket con la sesión
-- del usuario — las Server Actions comprueban el rol y luego leen/escriben el
-- objeto con `service_role`. Estas políticas existen para que una clave
-- anónima filtrada no pueda descargar ni tocar los logos de los clientes.

drop policy if exists logos_lectura on storage.objects;
create policy logos_lectura on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'logos-clientes'
    and public.get_user_rol() in ('admin', 'operador', 'consulta')
  );

drop policy if exists logos_escritura on storage.objects;
create policy logos_escritura on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'logos-clientes'
    and public.get_user_rol() in ('admin', 'operador')
  );

drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'logos-clientes'
    and public.get_user_rol() = 'admin'
  );
