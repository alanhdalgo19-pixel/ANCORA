-- Prompt 7 — Corrección fiscal del transporte + archivo del PDF en Storage.
--
-- APLICAR MANUALMENTE desde el SQL Editor de Supabase, igual que la migración
-- 20260725000000 del Prompt 6: la API REST de Supabase no ejecuta DDL.
--
-- ── Contexto del bug (CLAUDE.md sección 13.6) ────────────────────────
--
-- El wizard del Prompt 6 sumaba el transporte DESPUÉS del IVA:
--
--     total = subtotal_con_descuento + iva_importe + transporte
--
-- Eso factura el transporte como importe neto exento, cosa que no es. El
-- transporte forma parte de la base imponible del presupuesto y tributa al
-- mismo tipo que el resto:
--
--     base_imponible = subtotal * (1 - descuento/100) + transporte
--     iva_importe    = base_imponible * iva_pct / 100
--     total          = base_imponible + iva_importe
--
-- `subtotal` no cambia de significado: sigue siendo la suma bruta de líneas,
-- sin descuento y sin transporte. La base imponible pasa a ser una columna
-- propia en vez de recalcularse en cada pantalla, para que el PDF (documento
-- que ve el cliente) y la base de datos no puedan divergir nunca.

-- ── 1. Nuevas columnas ───────────────────────────────────────────────

alter table presupuestos
  add column if not exists base_imponible numeric(10,2) not null default 0;

comment on column presupuestos.base_imponible is
  'subtotal * (1 - descuento_manual_pct/100) + transporte. Es la base sobre la que se calcula el IVA.';

-- Ruta del PDF archivado en el bucket `presupuestos-pdf`, con la forma
-- {año}/Ancora_Presupuesto_{numero}.pdf. Null mientras el presupuesto sea
-- borrador: los borradores se generan al vuelo y no se archivan.
alter table presupuestos
  add column if not exists pdf_storage_path text;

comment on column presupuestos.pdf_storage_path is
  'Ruta dentro del bucket presupuestos-pdf. Null en borradores: solo se archiva el PDF al emitir.';

-- Marca de "el PDF archivado ya no refleja el presupuesto". Por diseño un
-- presupuesto emitido no se puede editar, así que en la práctica solo se activa
-- si la subida a Storage falló al emitir; la descarga lo regenera.
alter table presupuestos
  add column if not exists pdf_regeneracion_pendiente boolean not null default false;

comment on column presupuestos.pdf_regeneracion_pendiente is
  'True si el PDF archivado no es válido (p. ej. falló la subida al emitir). La descarga lo regenera y archiva de nuevo.';

-- ── 2. Recálculo de los presupuestos existentes ──────────────────────
--
-- Los presupuestos ya emitidos también se recalculan: hasta ahora tenían el
-- total mal, y un documento con IVA mal calculado no debe conservarse por
-- "inmutabilidad". La inmutabilidad protege los PRECIOS pactados (subtotal y
-- líneas, que no se tocan), no un error aritmético en el IVA.

update presupuestos
set base_imponible = round(
      (subtotal * (1 - coalesce(descuento_manual_pct, 0) / 100)) + coalesce(transporte, 0),
      2
    );

update presupuestos
set iva_importe = round(base_imponible * iva_pct / 100, 2),
    total       = base_imponible + round(base_imponible * iva_pct / 100, 2);

-- ── 3. Políticas de Storage del bucket `presupuestos-pdf` ────────────
--
-- El bucket lo crea `npm run setup:storage` (scripts/setup_storage_bucket.mjs);
-- estas políticas son defensa en profundidad. La aplicación nunca accede al
-- bucket con la sesión del usuario: el route handler comprueba primero el
-- acceso al presupuesto con RLS y luego lee/escribe el objeto con el cliente
-- `service_role` (que ignora estas políticas por diseño). Aquí se deja
-- únicamente lectura para usuarios autenticados con rol conocido, de forma que
-- una clave anónima filtrada no pueda descargar presupuestos de clientes.

drop policy if exists presupuestos_pdf_lectura on storage.objects;
create policy presupuestos_pdf_lectura on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'presupuestos-pdf'
    and public.get_user_rol() in ('admin', 'operador', 'consulta')
  );

drop policy if exists presupuestos_pdf_admin_escritura on storage.objects;
create policy presupuestos_pdf_admin_escritura on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'presupuestos-pdf'
    and public.get_user_rol() = 'admin'
  )
  with check (
    bucket_id = 'presupuestos-pdf'
    and public.get_user_rol() = 'admin'
  );
