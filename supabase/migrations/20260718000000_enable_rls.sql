-- Activa Row Level Security en todas las tablas del esquema y define
-- políticas por rol (admin/operador/consulta) — ver CLAUDE.md sección 13
-- (deuda técnica) y sección 14, decisión 2 (Prompt 1).
--
-- Nota: el prompt de esta sesión mencionaba una tabla `colores`, pero no
-- existe en el esquema (ni en 20260717000000_initial_schema.sql ni en
-- src/types/database.ts — CLAUDE.md sección 12 confirma "17 tablas"). Se
-- omite aquí; hay que confirmar con Alan si es una tabla pendiente de crear
-- o un residuo del prompt.

-- ── Función de utilidad: rol del usuario autenticado ────────────────
--
-- SECURITY DEFINER es imprescindible: si fuera SECURITY INVOKER, evaluar
-- esta función dentro de una política sobre la propia tabla `usuarios`
-- volvería a disparar RLS sobre `usuarios`, entrando en recursión. Al ser
-- SECURITY DEFINER se ejecuta con los privilegios del propietario de la
-- función (que no está sujeto a RLS), rompiendo el ciclo.
create or replace function public.get_user_rol()
returns rol
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

grant execute on function public.get_user_rol() to authenticated;

-- ── usuarios: admin acceso total; operador/consulta solo su propia fila ──

alter table usuarios enable row level security;

create policy usuarios_admin_all on usuarios
  for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

create policy usuarios_select_propia_fila on usuarios
  for select
  using (id = auth.uid());

-- ── clientes: admin ALL; operador SELECT/INSERT/UPDATE; consulta SELECT ──

alter table clientes enable row level security;

create policy clientes_admin_all on clientes
  for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

create policy clientes_select on clientes
  for select
  using (public.get_user_rol() in ('admin', 'operador', 'consulta'));

create policy clientes_operador_insert on clientes
  for insert
  with check (public.get_user_rol() = 'operador');

create policy clientes_operador_update on clientes
  for update
  using (public.get_user_rol() = 'operador')
  with check (public.get_user_rol() = 'operador');

-- ── presupuestos: mismo patrón que clientes ─────────────────────────

alter table presupuestos enable row level security;

create policy presupuestos_admin_all on presupuestos
  for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

create policy presupuestos_select on presupuestos
  for select
  using (public.get_user_rol() in ('admin', 'operador', 'consulta'));

create policy presupuestos_operador_insert on presupuestos
  for insert
  with check (public.get_user_rol() = 'operador');

create policy presupuestos_operador_update on presupuestos
  for update
  using (public.get_user_rol() = 'operador')
  with check (public.get_user_rol() = 'operador');

-- ── lineas_presupuesto: mismo patrón que clientes ───────────────────

alter table lineas_presupuesto enable row level security;

create policy lineas_presupuesto_admin_all on lineas_presupuesto
  for all
  using (public.get_user_rol() = 'admin')
  with check (public.get_user_rol() = 'admin');

create policy lineas_presupuesto_select on lineas_presupuesto
  for select
  using (public.get_user_rol() in ('admin', 'operador', 'consulta'));

create policy lineas_presupuesto_operador_insert on lineas_presupuesto
  for insert
  with check (public.get_user_rol() = 'operador');

create policy lineas_presupuesto_operador_update on lineas_presupuesto
  for update
  using (public.get_user_rol() = 'operador')
  with check (public.get_user_rol() = 'operador');

-- ── Tablas de configuración: admin ALL; operador/consulta SELECT ────
--
-- Todas comparten exactamente el mismo patrón de políticas, así que se
-- generan en bucle para evitar 26 bloques idénticos y el riesgo de que
-- alguno quede desalineado con los demás.

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'proveedores',
    'prendas',
    'tecnicas',
    'tipos_picaje',
    'precios_prenda',
    'parametros_dtf',
    'parametros_bordado',
    'tarifas_serigrafia',
    'parametros_serigrafia',
    'parametros_impresion_directa',
    'parametros_sublimacion',
    'tramos_margen',
    'costes_operativos'
  ]
  loop
    execute format('alter table %I enable row level security', tabla);

    execute format(
      'create policy %I on %I for all using (public.get_user_rol() = ''admin'') with check (public.get_user_rol() = ''admin'')',
      tabla || '_admin_all',
      tabla
    );

    execute format(
      'create policy %I on %I for select using (public.get_user_rol() in (''admin'', ''operador'', ''consulta''))',
      tabla || '_select',
      tabla
    );
  end loop;
end $$;
