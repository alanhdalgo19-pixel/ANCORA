-- Esquema inicial del Proyecto Áncora — ver CLAUDE.md sección 6.
-- RLS NO se habilita en esta migración: las políticas por rol
-- (admin/operador/consulta) están pendientes de diseño en la fase de
-- autenticación (CLAUDE.md sección 9, Fase 1: "Autenticación y roles").

create extension if not exists pgcrypto;

-- ── Tipos enumerados ────────────────────────────────────────────────

create type rol as enum ('admin', 'operador', 'consulta');
create type tipo_cliente as enum ('esporadico', 'habitual');
create type tipo_proveedor as enum ('urgencia', 'precio', 'calidad');
create type tejido as enum ('algodon', 'poliester', 'mixto', 'neopreno');
create type codigo_tecnica as enum ('DTF', 'BORDADO', 'SERIGRAFIA', 'SUBLIMACION', 'IMPRESION_DIRECTA');
create type codigo_picaje as enum ('SENCILLO', 'MEDIO', 'COMPLEJO', 'PERSONALIZADO');
create type color_grupo as enum ('blanco', 'color', 'oscuro');
create type ubicacion as enum ('pecho', 'espalda');
create type posicion as enum ('pecho', 'espalda', 'manga', 'gorra', 'otro');
create type unidad_medida_bordado as enum ('por_puntada', 'por_100_puntadas', 'por_1000_puntadas');
create type estado_presupuesto as enum ('borrador', 'enviado', 'aceptado', 'rechazado', 'caducado');
create type tipo_linea as enum ('prenda', 'tecnica', 'extra');

-- ── Capa 1: datos maestros ──────────────────────────────────────────

create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol rol not null default 'operador',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cif text,
  email text,
  telefono text,
  direccion text,
  codigo_postal text,
  localidad text,
  provincia text,
  tipo_cliente tipo_cliente not null default 'esporadico',
  descuento_bordado_pct numeric(5, 2) not null default 0,
  persona_contacto text,
  condiciones_pago text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo tipo_proveedor,
  dias_entrega integer,
  activo boolean not null default true
);

create table prendas (
  id uuid primary key default gen_random_uuid(),
  codigo_interno text not null unique,
  nombre text not null,
  modelo text,
  proveedor_id uuid not null references proveedores (id),
  tejido tejido not null,
  disponible_oscuro boolean not null default false,
  descripcion text,
  activo boolean not null default true
);

create table tecnicas (
  id uuid primary key default gen_random_uuid(),
  codigo codigo_tecnica not null unique,
  nombre text not null,
  activa boolean not null default true
);

create table tipos_picaje (
  id uuid primary key default gen_random_uuid(),
  codigo codigo_picaje not null unique,
  nombre text not null,
  precio_base numeric(10, 2) not null,
  editable_en_presupuesto boolean not null default false
);

-- ── Capa 2: configuración de precios ────────────────────────────────

create table precios_prenda (
  id uuid primary key default gen_random_uuid(),
  prenda_id uuid not null references prendas (id) on delete cascade,
  color_grupo color_grupo not null,
  tipo_cliente tipo_cliente not null,
  desde_cantidad integer not null,
  hasta_cantidad integer,
  precio numeric(10, 2) not null
);

-- Tabla de configuración global (una sola fila) — patrón singleton.
create table parametros_dtf (
  id smallint primary key default 1 check (id = 1),
  ancho_rollo_cm numeric(5, 2) not null default 35.0,
  precio_metro numeric(10, 2) not null default 10.00,
  recorte_por_logo numeric(10, 2) not null default 0.10,
  mano_obra_por_minuto numeric(10, 2) not null default 0.32,
  preparacion_pct numeric(5, 2) not null default 20.0,
  minimo_trabajo numeric(10, 2) not null default 15.00,
  margen_seguridad_cm numeric(5, 2) not null default 0.5,
  minutos_setup_fijo numeric(10, 2) not null default 5,
  minutos_por_logo numeric(10, 4) not null default 0.1
);

create table parametros_bordado (
  id smallint primary key default 1 check (id = 1),
  precio_tarifa_1 numeric(10, 4) not null default 0.35,
  precio_tarifa_2 numeric(10, 4) not null default 0.40,
  precio_tarifa_3 numeric(10, 4) not null default 0.45,
  precio_personalizable_default numeric(10, 4) not null default 0.45,
  unidad_medida unidad_medida_bordado not null default 'por_1000_puntadas',
  minimo_pieza numeric(10, 2) not null default 1.00,
  minimo_trabajo numeric(10, 2) not null default 15.00
);

create table tarifas_serigrafia (
  id uuid primary key default gen_random_uuid(),
  tipo_cliente tipo_cliente not null,
  ubicacion ubicacion not null,
  num_colores integer not null check (num_colores in (1, 2)),
  desde_cantidad integer not null,
  hasta_cantidad integer not null,
  precio_unitario numeric(10, 2) not null
);

create table parametros_serigrafia (
  id smallint primary key default 1 check (id = 1),
  recargo_oscura_pecho_por_color numeric(10, 2) not null default 35.00,
  recargo_oscura_espalda_por_color numeric(10, 2) not null default 37.00,
  fotolito_pecho numeric(10, 2) not null default 14.00,
  fotolito_espalda numeric(10, 2) not null default 19.00,
  minimo_trabajo numeric(10, 2) not null default 20.00,
  pantone_por_color numeric(10, 2) not null default 25.00,
  vectorizacion numeric(10, 2) not null default 35.00
);

create table parametros_impresion_directa (
  id smallint primary key default 1 check (id = 1),
  usa_tarifa_serigrafia boolean not null default true,
  solo_algodon boolean not null default true,
  minimo_trabajo numeric(10, 2) not null default 15.00
);

-- Estructura provisional — tarifa real pendiente de Espe (CLAUDE.md sección 10, punto 5).
create table parametros_sublimacion (
  id smallint primary key default 1 check (id = 1),
  precio_unitario_base numeric(10, 2),
  cantidad_minima integer,
  tasa_merma_pct numeric(5, 2),
  solo_blanco_poliester boolean not null default true
);

create table tramos_margen (
  id uuid primary key default gen_random_uuid(),
  tecnica_id uuid not null references tecnicas (id),
  tipo_cliente tipo_cliente not null,
  desde_cantidad integer not null,
  hasta_cantidad integer,
  margen_pct numeric(5, 2) not null
);

-- valor es nullable: los importes reales están pendientes de confirmar con Espe.
create table costes_operativos (
  clave text primary key,
  valor numeric(10, 4),
  descripcion text
);

-- ── Capa 3: transacciones ───────────────────────────────────────────

create table presupuestos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  cliente_id uuid not null references clientes (id),
  usuario_id uuid not null references usuarios (id),
  fecha_emision date not null default current_date,
  fecha_validez date not null,
  estado estado_presupuesto not null default 'borrador',
  subtotal numeric(10, 2) not null default 0,
  iva_pct numeric(5, 2) not null default 21.0,
  iva_importe numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  transporte numeric(10, 2) not null default 0,
  descuento_manual_pct numeric(5, 2) not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz
);

create table lineas_presupuesto (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references presupuestos (id) on delete cascade,
  orden integer not null,
  tipo_linea tipo_linea not null,
  prenda_id uuid references prendas (id),
  tecnica_id uuid references tecnicas (id),
  descripcion text not null,
  cantidad integer not null,
  color text,
  color_grupo color_grupo,
  ancho_logo_cm numeric(5, 2),
  alto_logo_cm numeric(5, 2),
  posicion posicion,
  puntadas integer,
  num_colores integer,
  prenda_oscura boolean,
  tipo_picaje_id uuid references tipos_picaje (id),
  coste_interno numeric(10, 2) not null default 0,
  margen_aplicado_pct numeric(5, 2) not null default 0,
  precio_unitario numeric(10, 2) not null default 0,
  importe_linea numeric(10, 2) not null default 0,
  detalle_calculo jsonb
);

create index lineas_presupuesto_presupuesto_id_idx on lineas_presupuesto (presupuesto_id);
create index presupuestos_cliente_id_idx on presupuestos (cliente_id);
create index prendas_proveedor_id_idx on prendas (proveedor_id);
create index precios_prenda_prenda_id_idx on precios_prenda (prenda_id);
