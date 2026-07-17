-- Datos iniciales — solo valores confirmados explícitamente en CLAUDE.md.
-- NO se seedean: tarifas_serigrafia, precios_prenda, parametros_sublimacion
-- (más allá del default), tramos_margen, costes_operativos.valor —
-- pendientes de tarifas/valores reales de Espe (ver CLAUDE.md sección 10).

insert into proveedores (nombre, tipo, dias_entrega) values
  ('Roly', 'precio', 3),
  ('JHK', 'urgencia', 1),
  ('Fruit', null, null),
  ('Clique', null, null),
  ('Kariban', 'calidad', null);

insert into tecnicas (codigo, nombre) values
  ('DTF', 'DTF'),
  ('BORDADO', 'Bordado'),
  ('SERIGRAFIA', 'Serigrafía'),
  ('SUBLIMACION', 'Sublimación'),
  ('IMPRESION_DIRECTA', 'Impresión directa');

insert into tipos_picaje (codigo, nombre, precio_base, editable_en_presupuesto) values
  ('SENCILLO', 'Picaje sencillo', 40.00, false),
  ('MEDIO', 'Picaje medio', 50.00, false),
  ('COMPLEJO', 'Picaje complejo', 55.00, false),
  ('PERSONALIZADO', 'Picaje personalizado', 45.00, true);

-- Tablas de configuración singleton — los defaults de columna ya
-- reflejan los valores confirmados por Espe (CLAUDE.md sección 6.2).
insert into parametros_dtf default values;
insert into parametros_bordado default values;
insert into parametros_serigrafia default values;
insert into parametros_impresion_directa default values;
insert into parametros_sublimacion default values;

-- Claves esperadas de costes_operativos, sin valor todavía (pendiente Espe).
insert into costes_operativos (clave, valor, descripcion) values
  ('transporte_baleares', null, 'Coste de transporte a Baleares'),
  ('transporte_peninsula', null, 'Coste de transporte a Península'),
  ('electricidad_hora_aprox', null, 'Coste aproximado de electricidad por hora'),
  ('iva_estandar', 21.0, 'IVA estándar aplicado en presupuestos');
