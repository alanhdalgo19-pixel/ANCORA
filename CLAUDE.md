# Proyecto Áncora — Contexto del proyecto

> Este documento es la memoria persistente del proyecto. Léelo entero antes de cualquier tarea. No tomes decisiones técnicas, de diseño o de negocio que contradigan lo que aquí se establece. Si encuentras una decisión que no está documentada, pregunta al usuario antes de tomarla.

---

## 1. Qué es el Proyecto Áncora

Aplicación web de gestión de presupuestos para **Ancora Publicitat** (razón social fiscal: **Andes Publicitat, S.L.**, NIF B57326928), un taller de personalización textil ubicado en Son Ferriol, Mallorca. La empresa realiza bordado, serigrafía, DTF, sublimación e impresión directa sobre prendas (camisetas, polos, sudaderas, chaquetas) y otros soportes.

### Problema que resuelve

Hoy generan presupuestos manualmente en su software AON, calculando precios "a ojo" desde la experiencia de la dueña (Esperanza). Esto consume 20–45 minutos por presupuesto y produce inconsistencias. Hacen ~18 presupuestos al mes. La aplicación automatiza ese proceso aplicando tarifas estructuradas, calcula precios deterministicamente, genera PDFs profesionales y mantiene histórico.

### Restricciones de negocio importantes

- **Verifactu (España):** antes de septiembre de 2026, Ancora debe migrar de AON a un software de facturación que cumpla la nueva normativa española. Nuestra app **NO** factura ni emite documentos fiscales — solo presupuestos. Los presupuestos aceptados se exportarán a Excel para que Ancora los vuelque al software de facturación que elija.
- **Inmutabilidad de presupuestos:** un presupuesto enviado al cliente NO debe cambiar de precio si Espe actualiza la tarifa después. Cada línea guarda copia de cómo se calculó.
- **Cero curva de aprendizaje:** la operadora principal (Sonia) hace presupuestos entre llamadas, mientras factura y atiende al teléfono. La interfaz debe ser obvia: cada pantalla hace una sola cosa.

---

## 2. Usuarios y roles

| Rol | Persona real | Responsabilidades |
|-----|--------------|---------------------|
| **admin** | Esperanza ("Espe") y Mohamed | Configura tarifas, catálogo, márgenes, costes operativos. Ve métricas. Gestiona usuarios. |
| **operador** | Sonia | Crea presupuestos, los envía, gestiona clientes. NO toca tarifas. |
| **consulta** | (futuro) Vicente, comerciales | Solo lectura: ve presupuestos, clientes, productos. No edita nada. |

### Personas a tener presentes durante el diseño

- **Sonia (operadora principal):** atareada, multitarea, no técnica. La pantalla principal debe permitir crear un presupuesto en menos de 2 minutos cuando lleva el patrón.
- **Esperanza (dueña/admin):** quiere control de precios sin depender de programadores. El panel admin debe permitirle cambiar cualquier valor sin riesgo de romper presupuestos antiguos.
- **Vicente (operario):** dificultades para retener instrucciones. Si en el futuro usa la app, todo debe ser "arrastrar y soltar".

---

## 3. Stack técnico

| Capa | Tecnología | Por qué |
|------|------------|---------|
| Frontend | **Next.js 14 (App Router) + TypeScript estricto** | Industria estándar, server components, server actions reducen complejidad. |
| Estilos | **Tailwind CSS** + **shadcn/ui** | Tailwind para utilidades, shadcn para componentes base accesibles. |
| Base de datos + Auth + Storage | **Supabase** (PostgreSQL gestionado) | Auth, RLS, storage y DB en uno. Sin gestión de servidor. |
| Formularios | **React Hook Form + Zod** | Validación robusta tipada. |
| Iconos | **Lucide React** | Open source, tree-shakeable. |
| PDF | **@react-pdf/renderer** | Generación de PDF declarativa en React. |
| Gráficos (panel admin) | **Recharts** | Suficiente para las métricas necesarias. |
| Despliegue | **Vercel** | Integración nativa con Next.js. |
| Versionado | **Git + GitHub** | Estándar. |

### Versiones mínimas

- Node.js ≥ 20 LTS
- npm ≥ 10

### Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. Estructura de carpetas

```
ancora/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/login/           # Páginas no autenticadas
│   │   ├── (app)/                  # Páginas autenticadas
│   │   │   ├── page.tsx            # Panel de inicio (operador)
│   │   │   ├── presupuestos/       # CRUD presupuestos
│   │   │   ├── clientes/           # CRUD clientes
│   │   │   ├── composicion-dtf/    # Calculadora DTF múltiples logos
│   │   │   ├── admin/              # Panel administración
│   │   │   │   ├── prendas/
│   │   │   │   ├── tarifas/
│   │   │   │   ├── margenes/
│   │   │   │   ├── costes/
│   │   │   │   └── usuarios/
│   │   │   └── layout.tsx          # Layout autenticado
│   │   ├── api/                    # Route handlers
│   │   └── layout.tsx              # Layout raíz
│   ├── components/
│   │   ├── ui/                     # shadcn/ui generados
│   │   ├── presupuestos/           # Componentes de presupuestos
│   │   ├── admin/                  # Componentes del panel admin
│   │   └── shared/                 # Compartidos
│   ├── lib/
│   │   ├── supabase/               # Clientes Supabase (server, client, middleware)
│   │   ├── calculos/               # Lógica de cálculo por técnica
│   │   │   ├── dtf.ts
│   │   │   ├── bordado.ts
│   │   │   ├── serigrafia.ts
│   │   │   ├── sublimacion.ts
│   │   │   └── impresion-directa.ts
│   │   ├── pdf/                    # Generación de PDF
│   │   └── utils.ts
│   ├── types/                      # Tipos TypeScript del dominio
│   └── hooks/                      # Custom React hooks
├── supabase/
│   ├── migrations/                 # Migraciones SQL
│   └── seed.sql                    # Datos iniciales
├── public/                         # Assets estáticos
├── CLAUDE.md                       # Este documento
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## 5. Convenciones de código

### Idioma

- **Tablas, columnas y campos en español** (porque son conceptos del negocio): `presupuestos`, `lineas_presupuesto`, `tipo_cliente`.
- **Funciones, variables y componentes en inglés** (estándar técnico): `calculateDtfPrice`, `QuoteWizard`, `useClient`.
- **Comentarios en español.**
- **Mensajes de UI en español** (la usan Sonia y Espe).

### TypeScript

- Modo estricto activado (`strict: true`).
- Nunca usar `any`. Si el tipo no se conoce, usar `unknown` y validar.
- Tipos del dominio en `src/types/`.

### Formateo y nomenclatura

- Archivos de componentes: `PascalCase.tsx` (`QuoteWizard.tsx`).
- Archivos de utilidades: `kebab-case.ts` (`format-currency.ts`).
- Variables y funciones: `camelCase`.
- Constantes: `SCREAMING_SNAKE_CASE`.
- Tablas y columnas SQL: `snake_case`.

### React y Next.js

- Preferir **Server Components** por defecto. Solo usar `'use client'` cuando se necesite interactividad (formularios, modales, etc.).
- Usar **Server Actions** para mutaciones (no crear route handlers innecesarios).
- Layout autenticado verifica sesión en server-side y redirige a `/login` si no hay.

### Estilos

- Solo Tailwind CSS. No archivos .css sueltos (salvo `globals.css` minimal).
- Colores corporativos: ver sección 8.

### Manejo de errores

- Errores de validación → mostrar inline en el formulario.
- Errores de servidor → toast/snackbar visible.
- Nunca tragarse errores en silencio.

---

## 6. Base de datos — Esquema completo

15 tablas organizadas en 3 capas: datos maestros, configuración de precios, transacciones.

### 6.1. Capa 1 — Datos maestros

#### `usuarios`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | Generado por Supabase Auth |
| nombre | text | |
| email | text unique | |
| rol | enum('admin','operador','consulta') | Por defecto 'operador' |
| activo | boolean | Por defecto true (soft delete) |
| created_at | timestamp | |

#### `clientes`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| nombre | text | |
| cif | text | Puede ser null si es "CONTADO" |
| email | text | |
| telefono | text | |
| direccion | text | |
| codigo_postal | text | |
| localidad | text | |
| provincia | text | |
| tipo_cliente | enum('esporadico','habitual') | Por defecto 'esporadico'. Etiquetas alternativas en UI: "Cliente menor" / "Cliente mayor" |
| descuento_bordado_pct | numeric(5,2) | Descuento aplicado solo a clientes habituales. Default 0. |
| persona_contacto | text | |
| condiciones_pago | text | |
| activo | boolean | |
| created_at | timestamp | |

#### `proveedores`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| nombre | text | Roly, JHK, Fruit, Clique, Kariban |
| tipo | enum('urgencia','precio','calidad') | JHK=urgencia, Roly=precio, Kariban=calidad |
| dias_entrega | integer | JHK=1, Roly=3 |
| activo | boolean | |

#### `prendas`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| codigo_interno | text unique | Asignado por Ancora |
| nombre | text | "Polo técnico Roly Star" |
| modelo | text | Modelo del proveedor |
| proveedor_id | uuid FK | |
| tejido | enum('algodon','poliester','mixto','neopreno') | |
| disponible_oscuro | boolean | Si la prenda existe en color oscuro |
| descripcion | text | |
| activo | boolean | |

#### `tecnicas`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| codigo | enum('DTF','BORDADO','SERIGRAFIA','SUBLIMACION','IMPRESION_DIRECTA') | |
| nombre | text | |
| activa | boolean | |

#### `tipos_picaje`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| codigo | enum('SENCILLO','MEDIO','COMPLEJO','PERSONALIZADO') | |
| nombre | text | |
| precio_base | numeric(10,2) | Default: 40, 50, 55, 45 |
| editable_en_presupuesto | boolean | True solo para PERSONALIZADO |

### 6.2. Capa 2 — Configuración de precios

#### `precios_prenda`
Precio de cada prenda según color, tipo de cliente y tramo de cantidad.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| prenda_id | uuid FK | |
| color_grupo | enum('blanco','color','oscuro') | |
| tipo_cliente | enum('esporadico','habitual') | |
| desde_cantidad | integer | Inclusive |
| hasta_cantidad | integer | Inclusive (null = infinito) |
| precio | numeric(10,2) | |

#### `parametros_dtf`
Configuración global del DTF (una sola fila).

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| ancho_rollo_cm | numeric(5,2) | 35.0 | |
| precio_metro | numeric(10,2) | 10.00 | Confirmado por Espe |
| recorte_por_logo | numeric(10,2) | 0.10 | Confirmado por Espe |
| mano_obra_por_minuto | numeric(10,2) | 0.32 | Confirmado por Espe |
| preparacion_pct | numeric(5,2) | 20.0 | Confirmado por Espe |
| minimo_trabajo | numeric(10,2) | 15.00 | |
| margen_seguridad_cm | numeric(5,2) | 0.5 | Margen entre logos en el rollo |
| minutos_setup_fijo | numeric(10,2) | 5 | Pendiente confirmar con Espe |
| minutos_por_logo | numeric(10,4) | 0.1 | Pendiente confirmar con Espe |

#### `parametros_bordado`
Configuración del bordado (una sola fila).

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| precio_tarifa_1 | numeric(10,4) | 0.35 | Precio por unidad (la unidad la define `unidad_medida`) |
| precio_tarifa_2 | numeric(10,4) | 0.40 | |
| precio_tarifa_3 | numeric(10,4) | 0.45 | |
| precio_personalizable_default | numeric(10,4) | 0.45 | Valor inicial cuando se elige "personalizable" |
| unidad_medida | enum('por_puntada','por_100_puntadas','por_1000_puntadas') | por_1000_puntadas | **PENDIENTE confirmar con Espe en primer uso real.** Sospechamos que es por_1000_puntadas porque los precios reales de presupuestos antiguos solo cuadran con esa unidad. |
| minimo_pieza | numeric(10,2) | 1.00 | Confirmado por Espe |
| minimo_trabajo | numeric(10,2) | 15.00 | Por consistencia con DTF |

#### `tarifas_serigrafia`
Tabla cruzada de tarifas de serigrafía. Cada fila representa una combinación.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| tipo_cliente | enum('esporadico','habitual') | Espe tiene 2 tarifas, una por tipo |
| ubicacion | enum('pecho','espalda') | |
| num_colores | integer | 1 o 2 |
| desde_cantidad | integer | |
| hasta_cantidad | integer | |
| precio_unitario | numeric(10,2) | Precio base por unidad |

#### `parametros_serigrafia`
Valores globales y recargos.

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| recargo_oscura_pecho_por_color | numeric(10,2) | 35.00 | Confirmado en tarifa Ancora |
| recargo_oscura_espalda_por_color | numeric(10,2) | 37.00 | Confirmado en tarifa Ancora |
| fotolito_pecho | numeric(10,2) | 14.00 | Por color, una vez por trabajo |
| fotolito_espalda | numeric(10,2) | 19.00 | Por color, una vez por trabajo |
| minimo_trabajo | numeric(10,2) | 20.00 | Tarifa Ancora dice "1-10 uds = cargo 20€" |
| pantone_por_color | numeric(10,2) | 25.00 | |
| vectorizacion | numeric(10,2) | 35.00 | Por logo |

#### `parametros_impresion_directa`
Hereda de serigrafía sin fotolitos ni pantones.

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| usa_tarifa_serigrafia | boolean | true | Reutiliza `tarifas_serigrafia` sin añadir fotolitos ni pantones |
| solo_algodon | boolean | true | |
| minimo_trabajo | numeric(10,2) | 15.00 | |

#### `parametros_sublimacion`
Pendiente de definir por Espe. Estructura provisional:

| Campo | Tipo | Notas |
|-------|------|-------|
| precio_unitario_base | numeric(10,2) | Pendiente |
| cantidad_minima | integer | Pendiente |
| tasa_merma_pct | numeric(5,2) | Pendiente — Espe comentó riesgo alto |
| solo_blanco_poliester | boolean | true |

#### `tramos_margen`
Margen comercial aplicado al coste interno según cantidad.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| tecnica_id | uuid FK | |
| tipo_cliente | enum('esporadico','habitual') | |
| desde_cantidad | integer | |
| hasta_cantidad | integer | |
| margen_pct | numeric(5,2) | |

#### `costes_operativos`
Tabla key-value para valores globales.

| Campo | Tipo |
|-------|------|
| clave | text PK |
| valor | numeric(10,4) |
| descripcion | text |

Claves esperadas: `transporte_baleares`, `transporte_peninsula`, `electricidad_hora_aprox`, `iva_estandar`.

### 6.3. Capa 3 — Transacciones

#### `presupuestos`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| numero | text unique | Formato: `AAAA/NNNNNN/0` |
| cliente_id | uuid FK | |
| usuario_id | uuid FK | Quién lo creó |
| fecha_emision | date | |
| fecha_validez | date | Por defecto fecha_emision + 30 días |
| estado | enum('borrador','enviado','aceptado','rechazado','caducado') | |
| subtotal | numeric(10,2) | Suma de líneas |
| iva_pct | numeric(5,2) | 21.0 |
| iva_importe | numeric(10,2) | |
| total | numeric(10,2) | subtotal + iva |
| transporte | numeric(10,2) | 0 por defecto |
| descuento_manual_pct | numeric(5,2) | 0 por defecto |
| notas | text | Notas internas o comentarios al cliente |
| created_at | timestamp | |
| sent_at | timestamp | Cuándo se cambió a 'enviado' |
| accepted_at | timestamp | Cuándo se cambió a 'aceptado' |

#### `lineas_presupuesto`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| presupuesto_id | uuid FK | |
| orden | integer | Para ordenar las líneas en el PDF |
| tipo_linea | enum('prenda','tecnica','extra') | 'prenda' = venta de prenda, 'tecnica' = personalización, 'extra' = picaje, vectorización, etc. |
| prenda_id | uuid FK nullable | |
| tecnica_id | uuid FK nullable | |
| descripcion | text | Texto que aparece en el PDF |
| cantidad | integer | |
| color | text | |
| color_grupo | enum('blanco','color','oscuro') | Para precio prenda |
| ancho_logo_cm | numeric(5,2) | |
| alto_logo_cm | numeric(5,2) | |
| posicion | enum('pecho','espalda','manga','gorra','otro') | |
| puntadas | integer | Solo bordado |
| num_colores | integer | Solo serigrafía |
| prenda_oscura | boolean | Solo serigrafía |
| tipo_picaje_id | uuid FK | Solo bordado |
| coste_interno | numeric(10,2) | |
| margen_aplicado_pct | numeric(5,2) | |
| precio_unitario | numeric(10,2) | |
| importe_linea | numeric(10,2) | cantidad × precio_unitario |
| detalle_calculo | jsonb | **Snapshot completo del cálculo: ver sección 7.6** |

---

## 7. Reglas de negocio

### 7.1. Estados del presupuesto

```
borrador → enviado → aceptado
              ↓         
            rechazado
              ↓
            caducado (automático tras fecha_validez si no hay otra acción)
```

Transiciones permitidas únicamente en este orden. No se puede saltar de 'borrador' a 'aceptado' directamente.

### 7.2. Cálculo DTF

```
INPUTS: cantidad, ancho_logo, alto_logo, posicion
Si cliente_habitual: aplicar tarifa habitual donde aplique

PASO 1: logos_por_fila = floor((ancho_rollo - margen_seguridad) / (ancho_logo + margen_seguridad))
PASO 2: filas_necesarias = ceil(cantidad / logos_por_fila)
PASO 3: metros_necesarios = (filas_necesarias * (alto_logo + margen_seguridad)) / 100
PASO 4: material = metros_necesarios * precio_metro
PASO 5: recorte = cantidad * recorte_por_logo
PASO 6: minutos_estimados = minutos_setup_fijo + (minutos_por_logo * cantidad)
PASO 7: mano_obra = minutos_estimados * mano_obra_por_minuto
PASO 8: coste_interno = (material + recorte + mano_obra) * (1 + preparacion_pct/100)
PASO 9: si coste_interno < minimo_trabajo → coste_interno = minimo_trabajo
PASO 10: buscar margen_pct en tramos_margen según cantidad y tipo_cliente
PASO 11: precio_pre_extras = coste_interno * (1 + margen_pct/100)
PASO 12: si diseño nuevo → +37€ por vectorización si aplica
```

### 7.3. Cálculo Bordado

```
INPUTS: cantidad, puntadas, tarifa_seleccionada, tipo_picaje
Si cliente_habitual: aplicar descuento_bordado_pct sobre precio_unitario

PASO 1: precio_unitario = puntadas * precio_tarifa_seleccionada
        (donde precio_tarifa_seleccionada es uno de:
         precio_tarifa_1, precio_tarifa_2, precio_tarifa_3, o personalizado)
        AJUSTAR según unidad_medida:
         - por_puntada: precio_unitario = puntadas * tarifa
         - por_100_puntadas: precio_unitario = (puntadas/100) * tarifa
         - por_1000_puntadas: precio_unitario = (puntadas/1000) * tarifa
PASO 2: si cliente_habitual: precio_unitario *= (1 - descuento_bordado_pct/100)
PASO 3: si precio_unitario < minimo_pieza → precio_unitario = minimo_pieza
PASO 4: subtotal_bordado = precio_unitario * cantidad
PASO 5: si subtotal_bordado < minimo_trabajo → subtotal_bordado = minimo_trabajo
PASO 6: añadir picaje según tipo_picaje seleccionado (línea independiente en presupuesto)
```

### 7.4. Cálculo Serigrafía

```
INPUTS: cantidad, num_colores, ubicacion, prenda_oscura, tipo_cliente

PASO 1: buscar precio_unitario en tarifas_serigrafia donde:
        tipo_cliente = X AND ubicacion = Y AND num_colores = Z 
        AND cantidad ∈ [desde, hasta]
PASO 2: subtotal = precio_unitario * cantidad
PASO 3: si prenda_oscura: añadir recargo_oscura_pecho_o_espalda * num_colores
PASO 4: si subtotal < minimo_trabajo → subtotal = minimo_trabajo
PASO 5: añadir fotolitos (una sola vez por trabajo): fotolito_pecho_o_espalda * num_colores
        (como línea independiente en presupuesto)
PASO 6: aplicar margen si está configurado
```

Máximo 2 colores soportado actualmente. Si num_colores > 2: bloquear y mostrar aviso.

### 7.5. Cálculo Sublimación e Impresión directa

- **Sublimación:** estructura pendiente de tarifa de Espe.
- **Impresión directa:** usa `tarifas_serigrafia` SIN sumar fotolitos ni pantones. Resto idéntico.

### 7.6. Snapshot del cálculo (`detalle_calculo` JSON)

Cada línea guarda el detalle completo del cálculo en formato JSON. Esto garantiza inmutabilidad. Estructura ejemplo para DTF:

```json
{
  "tecnica": "DTF",
  "version_calculo": "1.0",
  "inputs": {
    "cantidad": 120,
    "ancho_logo_cm": 9,
    "alto_logo_cm": 4,
    "posicion": "pecho"
  },
  "parametros_aplicados": {
    "ancho_rollo_cm": 35,
    "precio_metro": 10.00,
    "recorte_por_logo": 0.10,
    "mano_obra_por_minuto": 0.32,
    "preparacion_pct": 20,
    "minimo_trabajo": 15,
    "margen_seguridad_cm": 0.5
  },
  "calculo": {
    "logos_por_fila": 3,
    "filas_necesarias": 40,
    "metros_necesarios": 1.80,
    "minutos_estimados": 17,
    "material": 18.00,
    "recorte": 12.00,
    "mano_obra": 5.44,
    "subtotal_sin_preparacion": 35.44,
    "preparacion": 7.09,
    "coste_interno": 42.53,
    "aplicado_minimo": false
  },
  "comercial": {
    "tipo_cliente": "esporadico",
    "tramo_cantidad": "100-499",
    "margen_pct": 40,
    "precio_pre_extras": 59.54,
    "extras": [],
    "precio_unitario": 0.50
  }
}
```

Cuando se renderiza la línea en un PDF o se duplica un presupuesto, se usan estos valores fijos, NO se recalcula desde las tarifas actuales.

### 7.7. Numeración de presupuestos

Formato: `AAAA/NNNNNN/0` donde:
- `AAAA` = año en 4 dígitos
- `NNNNNN` = número secuencial dentro del año, 6 dígitos, con ceros a la izquierda
- `/0` = sufijo de versión (siempre 0 en Fase 1; en futuras versiones podría usarse para revisiones)

El contador empieza en `2026/000001/0` y se incrementa automáticamente. **Atención:** Ancora ya está en el ~88 de 2026 cuando arranquemos. El primer presupuesto del sistema debe continuar la numeración real (a confirmar con Espe el número exacto).

### 7.8. Tipos de cliente

Etiquetas en UI:
- `esporadico` → "Cliente esporádico" / "Cliente menor"
- `habitual` → "Cliente habitual" / "Cliente mayor"

Umbral configurable. Inicialmente: facturación > 3.000 €/año = cliente habitual. Revisión anual. La asignación es manual: Espe marca el tipo de cliente en la ficha del cliente.

### 7.9. PDF de presupuesto

Estructura definida (replicar mockup):
- Cabecera con logo Ancora, título "PRESUPUESTO", número, fecha de emisión, fecha de validez.
- Badges visibles: estado del presupuesto (borrador/enviado/aceptado/rechazado/caducado) y tipo de cliente.
- "Emite: [nombre del usuario que creó el presupuesto]" — trazabilidad.
- Bloque "DE" (Andes Publicitat) y bloque "PARA" (cliente).
- Comentario opcional (persona de contacto, teléfono, email).
- Tabla de líneas con descripción enriquecida (sub-líneas técnicas).
- Notas estándar (5 puntos, configurables en panel admin).
- Subtotal, IVA 21%, TOTAL en color corporativo.
- Bloque forma de pago.
- Pie de firma.

Color corporativo principal: `#0c8aa3` (azul-cyan inspirado en logo Ancora).

---

## 8. Identidad visual

### Colores

```
--ancora-primary: #0c8aa3       /* Azul-cyan corporativo (logo) */
--ancora-primary-dark: #086A82  /* Hover */
--ancora-primary-light: #E6F4F7 /* Fondos suaves */
--text-primary: #1a1a1a
--text-secondary: #5a5a5a
--text-tertiary: #8a8a8a
--bg-primary: #ffffff
--bg-secondary: #fafafa
--bg-tertiary: #f4f4f4
--border-default: #e0e0e0
--border-strong: #d4d4d4
--success: #2E7D32
--warning: #B68900
--danger: #C62828
--info: #0c5a99
```

### Tipografía

- UI: stack del sistema (`-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, etc.) o **Inter** si se quiere consistencia entre plataformas.
- PDF: Helvetica / Arial (estándar imprenta).

### Principios visuales

- **Minimalismo:** mucho espacio en blanco, jerarquía clara.
- **Flat:** sin sombras dramáticas, sin gradientes.
- **Bordes finos:** 0.5px–1px, colores muy suaves.
- **Esquinas suaves:** `border-radius: 8px` para tarjetas, `4px` para inputs.

---

## 9. Plan de fases

### Fase 1 — Núcleo de cotización (6 semanas)
- Autenticación y roles
- CRUD clientes
- CRUD prendas (panel admin)
- Configuración de tarifas DTF, bordado, serigrafía, impresión directa (panel admin)
- Wizard de presupuesto con cálculo automático
- Generación de PDF
- Histórico y filtros
- Composición DTF múltiples logos
- Exportación a Excel

### Fase 2 — Fotomontaje (2 semanas, incluido como cortesía)
- Biblioteca de mockups de las 13 prendas top con zonas de estampación
- Subida de logo del cliente
- Composición automática
- Imagen final descargable e integrable en el PDF

### Fase 3 — Inventario y reestructuración (8 semanas)
- Asignación de códigos a referencias
- Inventario inicial
- Movimientos de stock
- Registro de prendas estropeadas
- Integración con software de facturación elegido post-Verifactu

---

## 10. Pendientes con Espe

Lista viva de cosas pendientes de confirmar. Marcar como [RESUELTO] cuando se aclare. Esta lista es lo que Alan debe llevar a la próxima reunión con Esperanza.

1. Estados intermedios adicionales al ciclo de vida del presupuesto.
2. Si algún proveedor diferencia precios por color individual (no solo blanco/color/oscuro).
3. Confirmar datos a recoger de clientes (persona contacto, condiciones, IBAN, descuento fijo).
4. [RESUELTO] DTF: parámetros confirmados.
5. Tarifa de sublimación: precio por unidad y cantidad mínima.
6. Confirmar mínimos por técnica (DTF 15€, serigrafía 20€, bordado 1€/pieza).
7. [RESUELTO] Picaje: 3 categorías + personalizable (40/50/55/45€).
8. [RESUELTO] 13 prendas top identificadas, falta precio de coste por proveedor.
9. Modelo exacto de la camiseta "Clique".
10. Significado del sufijo `/0` en numeración de presupuestos.
11. Logo de Ancora en formato vectorial.
12. Cálculo de minutos de operario DTF: confirmar valor de `minutos_setup_fijo` y `minutos_por_logo`.
13. Sobrecargo serigrafía prenda oscura: confirmado 35€/color pecho, 37€/color espalda.
14. [RESUELTO] Bordado: 3 tarifas (0.35/0.40/0.45) + personalizable (default 0.45), descuento habitual variable manual.
15. **[RESUELTO en Prompt 4] Unidad de medida del bordado: `por_1000_puntadas`**. Confirmado por triangulación con tests automáticos sobre los presupuestos históricos: con `por_puntada` Formentera saldría a 1.925€/pieza (imposible) y con `por_100_puntadas` a 19.25€/pieza (imposible); con `por_1000_puntadas` sale a 1.90€/pieza, coincidiendo con lo que Ancora cobró. La unidad sigue siendo configurable en el panel admin por si Espe quiere cambiar, pero el sistema opera con la unidad correcta desde el arranque.
16. Umbral exacto cliente habitual: 3.000 €/año con revisión anual.
17. Si la lógica cliente esporádico/habitual aplica a todas las técnicas (sí, confirmado).

---

## 11. Cómo trabajar con este proyecto

### Para Claude Code

- Antes de cualquier tarea, lee este documento entero si no lo has hecho.
- Si una decisión técnica no está aquí, **pregunta al usuario** antes de tomarla.
- Si una regla de negocio parece incorrecta o incompleta, **señálalo** en vez de inventar.
- No introduzcas dependencias nuevas sin justificarlas.
- Antes de crear código nuevo, verifica si ya existe algo similar.
- Cada cambio de schema en Supabase se hace mediante migración versionada.
- Los componentes UI deben ser accesibles (etiquetas ARIA, navegación por teclado).
- Mantén las funciones de cálculo (`src/lib/calculos/`) puras y testeables sin Supabase.

### Para el desarrollador (Alan)

- Cuando algo no funcione, copia el error completo a Claude Code.
- Cuando quieras un cambio, descríbelo en términos de negocio, no técnicos: "quiero que cuando Sonia haga un presupuesto…" en vez de "quiero que el componente X cambie el estado Y".
- Cada vez que termines una funcionalidad, prueba que funciona antes de pasar a la siguiente.
- Versiona con Git frecuentemente. Cada feature funcional = un commit.

---

## 12. Estado actual del proyecto

Estado a fecha de la última actualización del documento.

### Fase 1 — Núcleo de cotización

| Componente | Estado | Notas |
|------------|--------|-------|
| Bootstrap (setup, dependencias, estructura) | ✅ Completado | Prompt 0 |
| Esquema de base de datos (17 tablas) | ✅ Aplicado en Supabase | Migración inicial |
| Datos semilla base | ✅ Cargados | Técnicas, tipos_picaje, etc. |
| Autenticación funcional | ✅ Completado | Prompt 1 |
| Roles (admin/operador/consulta) | ✅ Funcionando | Gate en middleware y layout |
| Gestión de sesión | ✅ Funcionando | Cookies SSR |
| Usuarios iniciales sembrados | ✅ 4 usuarios creados | Alan, Espe, Sonia, Mohamed |
| Página de acceso denegado | ✅ | `/acceso-denegado` |
| RLS activado en todas las tablas | ✅ Completado | Prompt 2 |
| CRUD clientes | ✅ Completado | Prompt 2 |
| Semilla de 5 clientes reales | ✅ Cargados | Prompt 2 |
| Panel admin (dashboard + sidebar) | ✅ Completado | Prompt 3 |
| Panel admin: parámetros DTF | ✅ Completado | Prompt 3 |
| Panel admin: parámetros bordado | ✅ Completado | Prompt 3 |
| Panel admin: tarifas serigrafía (esporádico + habitual) | ✅ Completado | Prompt 3 |
| Panel admin: impresión directa | ✅ Completado | Prompt 3 |
| Panel admin: sublimación (con PTE) | ✅ Completado | Prompt 3 |
| Panel admin: tipos de picaje | ✅ Completado | Prompt 3 |
| Panel admin: márgenes provisionales | ✅ Completado | Prompt 3 |
| Panel admin: costes operativos | ✅ Completado | Prompt 3 |
| Panel admin: CRUD proveedores | ✅ Completado | Prompt 3 |
| Panel admin: catálogo de prendas + matriz de precios | ✅ Completado | Prompt 3 |
| Motor de cálculo por técnica | ✅ Completado con 145 tests | Prompt 4 |
| Tests automáticos (Vitest) | ✅ 208/208 passing | Prompt 4-5 |
| Composición DTF (bin packing múltiples logos) | ✅ Completado con 63 tests | Prompt 5 |
| Wizard de presupuesto multi-paso | ✅ Completado | Prompt 6 |
| Listado de presupuestos con filtros | ✅ Completado | Prompt 6 |
| Preview HTML del PDF | ✅ Completado | Prompt 6 |
| Duplicación de presupuestos | ✅ Completado | Prompt 6 |
| PDF real descargable con @react-pdf/renderer | ✅ Completado | Prompt 7 |
| Fix fiscal del transporte (base_imponible) | ✅ Completado | Prompt 7 |
| Datos fiscales de Ancora rellenados | ✅ Completado (email incluido) | Prompt 7 + Patch 7A |
| Almacenamiento de PDFs en Supabase Storage | ✅ Completado | Prompt 7 |
| Pulido visual (logo real, nav activa, PDF cabecera) | ✅ Completado | Patch 7A |
| Composición DTF avanzada integrada en wizard | ⏳ Pendiente obligatorio | Prompt futuro |
| Histórico avanzado con métricas | ⏳ Pendiente | Prompt 8 |
| Exportación a Excel | ⏳ Pendiente | Prompt 9 |

### Usuarios sembrados en Supabase Auth y tabla `usuarios`

| Nombre | Email | Rol | Notas |
|--------|-------|-----|-------|
| Alan Hidalgo | alan.hdalgo19@gmail.com | admin | Consultor del proyecto |
| Esperanza | esperanza@ancora.local | admin | Email ficticio, cambiar al desplegar |
| Sonia | sonia@ancora.local | operador | Email ficticio, cambiar al desplegar |
| Mohamed | mohamed@ancora.local | admin | Email ficticio, cambiar al desplegar |

Contraseña inicial de todos: `ancora2026`. **Cambiar antes de entregar en producción.**

---

## 13. Deuda técnica

### 13.1. [RESUELTO en Prompt 2] Row Level Security

RLS estaba desactivado en todas las tablas al terminar el bootstrap. **Se activó completamente durante el Prompt 2** con la migración `supabase/migrations/20260718000000_enable_rls.sql`.

Detalles de la implementación:
- Función de utilidad `public.get_user_rol()` con `SECURITY DEFINER` para evitar recursión al aplicar políticas sobre `usuarios`.
- Políticas por rol (`admin`, `operador`, `consulta`) aplicadas a las 17 tablas.
- Las políticas de las 13 tablas de configuración se generan con un bucle `DO $$ ... FOREACH ...` para reducir el riesgo de desalineación entre bloques.
- Nueva utilidad servidor `src/lib/supabase/admin.ts` que crea un cliente con `SUPABASE_SERVICE_ROLE_KEY` para operaciones que necesitan saltarse RLS (pre-check de email en login).
- El pre-check de "email no registrado" en `src/lib/supabase/actions.ts` ahora usa el cliente admin en vez de la clave anónima.

### 13.2. ⚠️ Operador puede desactivar clientes vía UPDATE (defensa en Server Action)

Sonia (rol operador) tiene permiso RLS de UPDATE completo sobre `clientes` (para editar teléfono, dirección, etc.). Técnicamente esto le permitiría enviar un UPDATE que ponga `activo = false` (soft delete), aunque el botón "Desactivar" no aparezca en su interfaz.

**Protección actual:** la Server Action `desactivarCliente` verifica el rol antes de ejecutar el UPDATE. Si un operador logra invocarla, devuelve error de autorización.

**Solución futura (Prompt de Fase 3):** añadir una política RLS más fina que impida al operador cambiar específicamente la columna `activo` (por ejemplo con un trigger que compare `NEW.activo` y `OLD.activo`, o dividiendo la política de UPDATE por columnas). Defensa en profundidad.

### 13.3. Tabla `colores` mencionada en documentación pero no existe

El `CLAUDE.md` original mencionaba en la sección 6.1 una tabla `colores`, pero **nunca se creó** en la migración inicial y no aparece en `types/database.ts`. El listado real es de 17 tablas.

**Estado actual:** el "color" de una prenda se guarda como texto libre en `lineas_presupuesto.color` (campo `text`). No hay paleta cerrada.

**Decisión pendiente:** valorar si se necesita una tabla `colores` con paleta cerrada (útil para consistencia y para filtros en catálogo) o si el texto libre es suficiente. Preguntar a Espe cuando sea relevante.

### 13.4. Márgenes provisionales para bordado y serigrafía puestos a 0%

**Hallazgo del Prompt 4:** los tests con presupuestos históricos revelaron que las tarifas de bordado (0.35/0.40/0.45 por 1000 puntadas) y las tablas de serigrafía **ya son precios de venta, no costes internos**. Aplicarles el margen provisional del sector (35-50%) inflaba los precios un 30-40% respecto a lo que Ancora cobra en realidad.

**Ejemplos concretos:**
- Formentera Lines: tarifa da 1.93€/pieza (~ 1.90€ que Espe cobró). Con margen 35% del tramo 100-499, el motor factura 2.61€/ud — 37% por encima de lo real.
- Serigrafía esporádico, 100 uds pecho 1 color: tarifa 1.27€/ud, con margen 30% el motor emite 1.65€/ud.

**Decisión tomada (A3):** los tramos de margen se mantienen en la arquitectura porque dan flexibilidad, pero los **valores provisionales de bordado, serigrafía, impresión directa y sublimación pasan a 0%** por defecto. Solo DTF conserva sus márgenes (60/50/40/30) porque ahí sí se construye un coste real desde material + mano de obra + preparación.

Espe puede subir el margen en el panel admin si quiere aplicar un recargo adicional. Por defecto el sistema factura como Ancora factura hoy.

**Nota:** este ajuste de los valores por defecto se hará en un mini-prompt de patch posterior al Prompt 4.

21. **Bordado con puntadas desconocidas al momento del presupuesto.** Detectado en Prompt 6: cuando Sonia no sabe las puntadas (aún no se ha digitalizado el logo), el motor `calcularBordado` lanza error con `puntadas <= 0` porque el precio SON las puntadas. Actualmente el formulario exige entero > 0. **Preguntar a Espe:** ¿debería existir un estado "pendiente de picar" que congele el presupuesto sin importe hasta que se conozcan las puntadas reales? Alternativa: dejar puntadas estimadas "a ojo" y ajustar al facturar.

22. **Descuentos y optimizaciones en presupuestos con múltiples líneas relacionadas.** Actualmente cada línea se factura de forma independiente (por posición sobre la prenda). Casos identificados que podrían justificar tratamiento especial:
    - **Caso A** — Cliente pide varias posiciones sobre la misma prenda (bordado pecho + DTF espalda + DTF gorra): ¿aplica algún descuento por volumen combinado en la segunda/tercera posición?
    - **Caso B** — Composición DTF con posiciones distintas en el mismo rollo: técnicamente `componerDTF()` podría empaquetar 240 logos (120 pecho + 120 espalda) en un rollo optimizado, ahorrando 5-15% de material. Actualmente cada línea consume su rollo por separado.
    - **Caso C** — Multi-prenda con misma técnica (100 camisetas + 50 polos + 30 sudaderas con mismo logo DTF): cada prenda es una línea separada.
    
    **Decisión provisional tomada:** en Fase 1 se factura línea por línea (como Ancora factura hoy en los presupuestos históricos analizados). La composición DTF avanzada del prompt futuro cubrirá parte del Caso B para clientes con volumen alto. **Preguntar a Espe** si aplica algún descuento implícito en estos casos actualmente.

23. **[PARCIALMENTE RESUELTO en Patch 7A] Logo de Ancora Publicitat.** Integrado el PNG oficial (recibido de Alan) en PDF, topbar, login, preview HTML y favicon (rombo CMYK). Calidad suficiente: a 130pt de ancho el PNG imprime a ~111 ppp — bien en pantalla, aceptable en papel A4. **Pendiente:** solicitar el SVG oficial (o un PNG de mayor resolución) a Espe cuando vuelva de vacaciones para uso en formatos grandes o carteles. Sustituir es reemplazar un único archivo (`public/logo-ancora.png`) sin tocar código.

24. **[RESUELTO en Patch 7A] Email corporativo de Ancora Publicitat.** Confirmado por Alan: `info@ancorapublicitat.es`. Aplicado en `src/lib/empresa.ts` y aparece automáticamente en PDF y preview con formato `Email: …`.

25. **Aislamiento RLS por operador (opcional).** Actualmente Sonia (operador) puede VER y descargar cualquier presupuesto de la app, no solo los suyos. Coherente con las políticas RLS del Prompt 2 y con el flujo real de un taller pequeño donde todos ayudan a todos. Si Espe/Mohamed piden aislamiento estricto (que Sonia solo vea SUS presupuestos), es un cambio de políticas RLS de la tabla `presupuestos` que afecta también al listado, ficha y preview HTML.

### 13.5. Node.js 20 será deprecado por @supabase/supabase-js

Durante el `npm run build` del Prompt 4 aparecen múltiples warnings:

```
Node.js 20 and below are deprecated and will no longer 
be supported in future versions of @supabase/supabase-js. 
Please upgrade to Node.js 22 or later.
```

**Estado actual:** funciona perfectamente con Node 20.20.2 (versión instalada en el desarrollo). El build compila sin errores.

**Deuda técnica:** cuando Node 20 alcance su fin oficial de vida (abril 2026) o cuando `@supabase/supabase-js` publique una versión que exija Node 22+, será necesario actualizar la máquina de desarrollo y las variables de entorno de producción (Vercel) a Node 22 LTS. Cambio menor.

### 13.6. [RESUELTO en Prompt 7] Transporte se sumaba DESPUÉS del IVA

**Estado:** RESUELTO en Prompt 7 mediante:
- Migración `20260726000000_fix_transporte_iva.sql` (aplicada manualmente en Supabase SQL Editor).
- Nueva columna `base_imponible` en `presupuestos`.
- Fórmula extraída a función pura `src/lib/presupuestos/totales.ts` con 7 tests dedicados.
- Recálculo automático de los presupuestos existentes con la fórmula correcta.
- Test de regresión que verifica que YA NO coincide con la fórmula antigua.
- UI actualizada con el orden correcto del desglose: subtotal → descuento → transporte → base imponible → IVA → TOTAL.

**Verificado en producción:** con subtotal 100€ + transporte 20€ + IVA 21%, el sistema devuelve base_imponible 120€, IVA 25,20€, total 145,20€. Y el caso canónico DTF de 120 uds pecho 9×4 sin transporte da subtotal 59,54€, IVA 12,50€, total 72,04€ (verificado en presupuesto real 2026/000096/0).

### 13.7. Composición DTF avanzada pendiente obligatoria

**Reconocido en Prompt 6 y confirmado por el usuario.** Actualmente `componerDTF()` (función pura de bin packing multi-logos) existe con 63 tests, pero **NO está integrada en el wizard**. El wizard sólo usa `calcularDTF` simple (un tamaño de logo por línea).

**Compromiso técnico:** este módulo se integrará **obligatoriamente** en un prompt futuro (probablemente Prompt 8 o 9). Requerirá:
- UI dedicada para añadir múltiples logos con `rotable: boolean` cada uno.
- Bien un tipo de "línea compuesta DTF" en `lineas_presupuesto`, bien una nueva sub-tabla `logos_composicion`.
- Preview visual del layout del rollo (con las coordenadas x, y que ya devuelve la función).

**Casos B y C de descuentos multi-línea** (ver sección 10 nota 22) están relacionados: cuando se integre la composición avanzada, resolverá automáticamente parte de las optimizaciones que hoy quedan como línea separada.

### 13.8. [RESUELTO en Patch 7A] Prompt de pulido visual

**Estado:** RESUELTO. Los dos detalles visuales detectados durante la validación del Prompt 7 se corrigieron en el Patch 7A junto con la integración del logo real y el email corporativo:

1. **Solapamiento del número de presupuesto con el título "PRESUPUESTO" en el PDF.** RESUELTO. Título reducido de 22pt → 18pt, `lineHeight` explícito en título y número, margen ajustado de 3 → 6pt. Verificación técnica: caja del título ocupa 21,6pt y el bloque del número arranca en y=27,6 → 6pt libres, verificado con número corto y largo. Cubierto por 2 tests de regresión de la cabecera.

2. **Topbar no marcaba la pestaña activa.** RESUELTO. Extraído sub-componente `EnlaceNav` en `Topbar.tsx` que usa `usePathname()`. Estilo: borde inferior de 2px en color corporativo (`#0c8aa3`) + `aria-current="page"` para accesibilidad. Activa también en subrutas (ej: `/presupuestos/[id]` mantiene "Presupuestos" resaltado).

Ambas correcciones validadas visualmente por Alan en el navegador.

---

## 14. Decisiones tomadas durante el desarrollo

Decisiones técnicas o de diseño tomadas por Claude Code durante los prompts secuenciales que no estaban en la especificación original. Se documentan aquí para trazabilidad y para que futuras sesiones las respeten.

### Prompt 1 — Autenticación y usuarios

1. **Verificación de usuario activo movida al middleware, no al layout.** Un Server Component no puede escribir cookies, así que un `signOut()` disparado desde `(app)/layout.tsx` no limpiaría realmente la cookie de sesión (se produciría un bucle de redirección con el middleware). La comprobación de "existe en usuarios y está activo" vive en `src/lib/supabase/middleware.ts`. El layout mantiene una comprobación defensiva de solo lectura.

2. **La comprobación previa de "email no registrado" usa la clave anónima** temporalmente, aprovechando que RLS está desactivado en todas las tablas. Cuando se active RLS (deuda técnica sección 13), este pre-check dejará de funcionar para usuarios anónimos y habrá que moverlo a un Server Action con la clave `service_role`.

3. **`scripts/seed_users.mjs` usa `fetch` directo contra la API de Supabase** (Auth Admin + REST) en lugar del SDK `@supabase/supabase-js`. El SDK inicializa un `RealtimeClient` que en Node 20 sin el paquete `ws` lanza `Error: Node.js 20 detected without native WebSocket support` y aborta el script. Se evita añadir `ws` como dependencia nueva; el script no necesita Realtime.

4. **Se creó `.claude/launch.json`** para poder previsualizar `npm run dev` desde el navegador integrado de Claude Code. Es tooling de desarrollo, no afecta a la aplicación en producción.

### Prompt 2 — RLS y CRUD de clientes

1. **Tabla `colores` mencionada en la especificación pero no existe.** Se omitió de la migración RLS por no estar en el esquema real. Ver sección 13.3 para decisión futura.

2. **Políticas RLS de las 13 tablas de configuración generadas con bucle PL/pgSQL.** En lugar de escribir 26 bloques `CREATE POLICY` repetidos (uno para admin y otro para operador/consulta por cada tabla), se usa un `DO $$ ... FOREACH ...` que itera sobre el listado. Ventaja: menos código, menos riesgo de que alguna quede desalineada; una modificación futura de las reglas se hace en un solo sitio.

3. **RLS no impide UPDATE de `activo=false` por operador; la protección vive en la Server Action.** Sonia (operador) tiene UPDATE completo sobre `clientes` por RLS. La verificación de rol para desactivar clientes está en `desactivarCliente` (Server Action), no en la política SQL. Documentado como deuda técnica menor en sección 13.2.

4. **Campo "Móvil" del seed de clientes guardado en `telefono`.** El esquema tiene un único campo `telefono` (no distingue fijo/móvil). Los datos originales de los presupuestos históricos usaban "Móvil: XXX" — se copiaron directamente al campo `telefono` sin distinguir tipo.

5. **Provincia por defecto en `"Illes Balears"`.** Tanto en el seed como en el valor por defecto del formulario de alta. Ancora está en Baleares y la mayoría de clientes son isleños.

### Prompt 3 — Panel de administración completo

1. **Tablas editables (serigrafía, márgenes, precios de prenda) usan formulario único con todas las celdas visibles**, no edición celda a celda ni modales. Ventaja: Espe puede meter muchos precios de golpe sin abrir/cerrar diálogos. Guardado en bloque con Server Action única.

2. **Preview de cálculo DTF en el formulario admin es una función local del propio componente**, no importa desde `src/lib/calculos/dtf.ts`. Buena separación: el motor de cálculo real es del Prompt 4 (implementación de funciones puras testeables). Cuando el motor real esté hecho, la preview del admin puede migrar a usarlo.

3. **Sin dependencias nuevas — checkboxes nativos en vez de Radix Switch/Checkbox.** Reduce peso del bundle y evita añadir complejidad de shadcn/ui donde no aporta valor.

4. **Sin toasts — se mantuvo el patrón inline "Guardado ✓" / error en texto**, igual que `ClienteForm.tsx` del Prompt 2. Coherencia visual con el resto de la app.

5. **Proveedores y prendas NO llevan guard extra de rol en Server Actions** (como sí tiene `desactivarCliente` del Prompt 2), porque RLS ya restringe esas 13 tablas de configuración a admin, y toda la subruta `/admin/*` está gateada en el middleware. Evita sobreingeniería.

6. **El seed de admin patchea proveedores incompletos.** Fruit, Clique y Kariban existían en la migración inicial con campos `tipo` y `dias_entrega` incompletos o vacíos. El seed los completa con los valores correctos: Fruit (precio, 3), Clique (calidad, 3), Kariban (calidad, 4).

7. **Uso de "plan mode" de Claude Code para este prompt.** Dado el volumen (12 páginas + 380+ inserts + 3894 líneas añadidas), Claude Code creó primero un plan detallado en `.claude/plans/tingly-coalescing-seal.md` que fue aprobado antes de ejecutar la implementación. Buen patrón para prompts complejos.

8. **Dos bugs detectados y corregidos durante la implementación**: (a) error de iteración TypeScript en la generación de la matriz de precios de prenda; (b) bug en la lógica de "prendas sin precios" que contaba mal las prendas cuando todos los precios eran 0.00. Ambos resueltos antes de commit final.

### Prompt 4 — Motor de cálculo con tests

**Hallazgos revelados por los tests con datos históricos:**

- **Confirmada la unidad `por_1000_puntadas` para bordado** por triangulación con Formentera Lines (302 uds a 1.90€/pieza real vs 1.90€ calculado). Ver sección 10 punto 15 [RESUELTO].
- **Descubierto que las tarifas de bordado y serigrafía ya son precios de venta**, no costes internos. Aplicar margen provisional infla los precios un 30-40% respecto a lo que Ancora cobra. Ver sección 13.4 y decisión 10 abajo.

**Decisiones técnicas de implementación:**

1. **`importe_linea` es el valor autoritativo**, no `precio_unitario × cantidad`. En el caso canónico salen 59.54€ vs 60.00€. El unitario se redondea solo para mostrarlo en el PDF. Contradice la nota del esquema (`importe_linea = cantidad × precio_unitario`) — Decisión B3 tomada para el PDF: se mostrará `importe_linea` real como total y `precio_unitario` redondeado como referencia, aceptando que la multiplicación matemática pura no cuadra (es el estándar de ERPs profesionales).

2. **`redondear2` usa half-up con normalización `toPrecision(12)`**, no redondeo bancario. `Math.round(n*100)/100` a secas falla con 1.235 (da 1.23).

3. **`minutos_estimados` se redondea a entero con `Math.round`.** CLAUDE.md 7.6 lo muestra entero pero no dice cómo redondear.

4. **El coste interno se compone de sumandos ya redondeados**, para que el desglose del snapshot cuadre céntimo a céntimo en pantalla.

5. **Impresión directa comparte núcleo con serigrafía (`calcularBaseTarifaSerigrafia`), no la envuelve.** No es idéntica: tiene mínimo propio (15€ vs 20€) y tramos de margen propios. Envolverla obligaría a pasarle una config falseada y parchear el snapshot después.

6. **Snapshots tipados con genéricos (`CalculoResultado<TInputs, TCalculo>`)** en vez de `Record<string, unknown>`, para que el wizard y los tests accedan a `detalle_calculo.calculo.logos_por_fila` sin casts.

7. **`TramoMargen` y `Ubicacion` viven en `lib/calculos/types.ts` NO en los de `types/database.ts`.** El del motor es la forma de cálculo (`{ desde, hasta, margen_pct }`, ya filtrada por técnica y cliente); `Ubicacion` del motor equivale a `Posicion` del esquema. Documentado en la cabecera del fichero.

8. **`aplicarMargen` lanza error si no hay tramo** en vez de asumir margen 0. Un presupuesto sin margen es un error de configuración, no un caso válido.

9. **Sublimación bloquea con `precio_unitario_base = 0` (estado semilla actual)**, con mensaje que apunta al panel admin: "Tarifa de sublimación pendiente de configurar (PTE TARIFA ESPE)".

10. **Márgenes provisionales ajustados: A3.** Los tramos de margen se mantienen en la arquitectura, pero los valores por defecto de bordado, serigrafía, impresión directa y sublimación pasan a 0%. Solo DTF conserva 60/50/40/30. Ver sección 13.4 para el razonamiento completo. **Este ajuste se aplicará en un mini-prompt de patch tras cerrar Prompt 4.**

**Nota adicional:** los stubs de Prompt 0 (`calculateDtfPrice`, etc.) se han sustituido; no tenían ningún consumidor en la app.

**Cobertura de tests:** 145/145 tests passing distribuidos así:
- `helpers.test.ts`: 28 tests
- `dtf.test.ts`: 36 tests (incluido caso canónico documentado en CLAUDE.md 7.2)
- `bordado.test.ts`: 27 tests (incluidos Formentera Lines y Colla Castellers reales)
- `serigrafia.test.ts`: 27 tests (esporádico + habitual + oscura + errores)
- `impresion-directa.test.ts`: 13 tests
- `sublimacion.test.ts`: 14 tests

### Patch 4A — Ajuste de márgenes provisionales

Aplicado inmediatamente tras Prompt 4. Actualizó 32 filas de `tramos_margen` (4 técnicas × 4 tramos × 2 tipos de cliente) poniendo el `margen_pct` a 0 para BORDADO, SERIGRAFIA, IMPRESION_DIRECTA y SUBLIMACION. DTF conserva 60/50/40/30. Se implementó como script Node (idempotente) en lugar de migración SQL para consistencia con los otros seeds. También parchea `seed_admin_data.mjs` para evitar reintroducción de valores viejos si alguien re-ejecuta el seed. Ver sección 13.4 marcada como [APLICADO en Patch 4A].

### Prompt 5 — Composición DTF (bin packing múltiples logos)

**Hallazgos revelados por los tests:**

1. **Test 2 (caso Doyle) no puede bajar de 3 metros — es físicamente imposible.** Un logo de 25 cm de ancho entra solo uno por fila en un rollo de 35 cm, así que 20 espaldas de 25×30 consumen 6.10 m por sí solos. El óptimo teórico absoluto (18.600 cm² de logos ÷ 35 cm de ancho) es 5.31 m. El algoritmo produce 7.64 m con 69.6% de eficiencia. La estimación original del prompt (< 3 metros) era matemáticamente imposible; se corrigió el test al valor real con razonamiento comentado.

2. **Test 8 (caso Josefa): precio medio es 1.06 €, no ≤ 1 €.** El rango histórico 0.30-1.00 € viene de logos de pecho sueltos; aquí 20 de las 123 unidades son espaldas de 20×25 (500 cm², quince veces el área de un pecho) y tiran de la media. Banda comercial plausible: 0.30-1.50 €.

**Layouts observados en tests reales:**

| Caso | Unidades | Metros | Estanterías | Eficiencia | Filas mixtas |
|------|----------|--------|-------------|------------|--------------|
| Doyle (9×4 ×100 + 25×30 ×20) | 120 | 7.64 m | 54 | 69.6% | 0 |
| Josefa (8×4 ×100 + 20×25 ×20 + 5×3 ×3) | 123 | 6.01 m | 40 | 63.0% | 20 |

En el caso Josefa el hueco lateral de cada fila de espalda (14 cm libres tras un logo de 20 cm) se rellena con un logo de pecho y una etiqueta — **exactamente lo que hace Josefa a mano en Corel**. En Doyle no ocurre: la fila de 25 cm deja 9.0 cm y un logo de 9 cm necesita 9.5 con su margen; se queda a 5 mm.

**Decisiones técnicas de implementación:**

1. **La orientación óptima minimiza la altura, NO el ancho.** El enunciado del prompt decía "si ancho_cm > alto_cm, rotarlo" pero contradecía sus propios tests (5×20 → 20×5). La regla correcta: se rota cuando `alto > ancho`, dejando la dimensión mayor en horizontal, porque el rollo se paga por metro lineal. Logos cuadrados no se rotan (por estabilidad del layout).

2. **`detalle_calculo` usa tipo propio `ComposicionSnapshot`**, no `Record<string, unknown>`. El enunciado lo declaraba genérico, pero la decisión 6 del Prompt 4 fijó snapshots tipados. Tampoco reutiliza `DetalleCalculo`: la composición añade dos bloques (`composicion`, `layout`), su comercial no tiene unitario ni extras, y `"DTF_COMPOSICION"` no es un `CodigoTecnica` del esquema — es un modo dentro de DTF.

3. **El snapshot añade `altura_consumida_cm`.** Sin el alto real en cm no se puede dibujar el layout ni auditar la eficiencia (`metros_necesarios` va redondeado a 2 decimales). Es el dato que necesitará la visualización del Prompt 6 (o futura fase 2).

4. **`componerDTF` emite 3 tipos de warnings no bloqueantes:**
   - Eficiencia < 60% (composición muy ineficiente, revisar tamaños)
   - Logo no rotable que ahorraría rollo tumbado (avisa de decisión potencialmente subóptima)
   - Última fila por debajo del 50% de ocupación (subóptimo pero inevitable en algunos casos)

**Cobertura de tests:** 63 tests nuevos en `composicion-dtf.test.ts`, superando el mínimo de 15 requerido. Cobertura de: casos básicos (1/2/3 tamaños), errores explícitos, casos reales de Ancora (Doyle, Josefa), tests de propiedad (no solapamiento, todo cabe en el rollo, determinismo), tests de eficiencia. Total del proyecto: **208/208 passing**.

**Sin cambios en `calcularDTF` ni en sus 36 tests.** `componerDTF` es una función completamente independiente. La integración de ambas la resolverá el wizard en el Prompt 6.

### Prompt 6 — Wizard de presupuesto

**Las 19 decisiones técnicas de Claude Code durante Prompt 6 están registradas directamente en el commit `0793223`.** Este bloque queda como referencia complementaria con las decisiones más importantes:

1. **Persistencia desde el paso 1.** El presupuesto se crea en Supabase al confirmar el cliente, con estado `borrador`. Todos los pasos posteriores modifican el registro real. Si Sonia recarga la página, el wizard reanuda donde estaba porque el presupuesto ya existe.

2. **Numeración de presupuestos arranca en `2026/000090/0`.** Ancora ya iba por el 88 según los presupuestos históricos analizados. Se dejó margen de seguridad. Ajustable en admin más adelante.

3. **Puente motor ↔ Supabase en `calcular-linea.ts`.** Único sitio del código que lee tarifas de la BD, construye el config y lo pasa a las funciones puras del motor. El motor sigue intacto y puro.

4. **Bordado con 0 puntadas: bloqueo con mensaje amigable.** La estimación "deja 0 y Espe lo completará" del enunciado del prompt no era implementable — el motor lanza error con `puntadas <= 0` con razón. El formulario exige entero > 0 y el texto de ayuda remite a Espe. Añadida nota pendiente 21 sobre posible estado "pendiente de picar".

5. **Extras como líneas separadas.** Picaje, fotolitos, vectorización y pantones se guardan como filas de `lineas_presupuesto` con `tipo_linea = 'extra'` y `linea_padre_id` apuntando a la línea principal. Esto permite editarlas independientemente en el hub y aparecen desglosadas en el preview y PDF.

6. **Aceptar/rechazar restringido a admin.** Sonia puede emitir pero no cierra el ciclo comercial. Es una restricción explícita para separar responsabilidades. Reconsideramos en Fase 2 si Espe pide flexibilidad.

7. **Transporte se suma después del IVA (INCORRECTO, ver sección 13.6).** Se implementó literal según el enunciado del prompt. **A corregir antes/durante Prompt 7.**

8. **Prendas con precio 0 € pasan con aviso ámbar** en lugar de bloquear. Solo bloquea si NO existe ninguna fila de precio para esa combinación color/tipo_cliente/tramo. Coherente con el estado semilla actual (las 13 prendas top están sin precios pendientes de Espe).

9. **Datos fiscales de Ancora en `null` en `src/lib/empresa.ts`.** El preview los pinta como "PENDIENTE" en ámbar con aviso arriba. **Rellenar antes del Prompt 7:** CL. BLATERA 37 B, 07198 SON FERRIOL (ILLES BALEARS), Tfno.: 971 428 072, N.I.F.: B57326928, IBAN LA CAIXA ES84 2100 6328 9513 0008 6685.

10. **Migración `20260725000000_wizard_prep.sql` aplicada manualmente por el usuario.** La API REST de Supabase no ejecuta DDL. Añade `linea_padre_id` a `lineas_presupuesto`, índices sobre `linea_padre_id` y `presupuestos.fecha_emision`, y política RLS de DELETE para operador. Aplicada mediante SQL Editor de Supabase.

11. **`calcularClienteRapido` y `previsualizarLinea` añadidas como Server Actions extra.** No estaban en el enunciado original pero mejoran la experiencia (crear cliente sin salir del wizard, previsualizar cálculo antes de guardar).

**Estado de tests:** 208/208 tests siguen passing tras Prompt 6. El wizard usa el motor de cálculo puro y por tanto está indirectamente cubierto por los tests del motor.

### Prompt 7 — PDF descargable real + fix fiscal del transporte

**Objetivos cumplidos:**
1. Datos fiscales de Ancora rellenados en `src/lib/empresa.ts` (con `email = null` pendiente de confirmar con Espe).
2. Bug fiscal del transporte corregido (sección 13.6 marcada como RESUELTO).
3. PDF descargable real con `@react-pdf/renderer` archivado en Supabase Storage.

**Decisiones técnicas:**

1. **Datos fiscales completos con email null limpio.** El PDF omite silenciosamente la línea del email si es `null` (no muestra "PENDIENTE"), evitando dar mala imagen al cliente. Los demás campos (razón social, NIF, dirección, teléfono, IBAN) están completos.

2. **Aritmética del transporte extraída a función pura `src/lib/presupuestos/totales.ts`.** Con 7 tests dedicados. Incluye test de regresión que verifica que el resultado NO coincide con la fórmula antigua (para evitar reintroducir el bug).

3. **`@react-pdf/renderer` ya estaba en `package.json` desde Prompt 0.** No hubo dependencia nueva. Route handler en `/api/presupuestos/[id]/pdf`, archivo en Storage al emitir, botones en ficha, preview y listado.

4. **Dos bugs de layout PDF detectados y corregidos por Claude Code durante la implementación:**
   - Cabecera de tabla con `fixed` se repetía en la página de condiciones (arreglado).
   - Signo menos U+2212 del descuento salía en blanco porque las fuentes estándar de react-pdf usan WinAnsi y ese carácter no existe. Comprobado glifo a glifo el resto: em dash (—), `·`, `€`, `×` y comillas tipográficas sí existen.

5. **`npm run setup:storage` como tarea manual del usuario.** El bucket `presupuestos-pdf` se crea mediante un script Node ejecutable (`scripts/setup_storage_bucket.mjs`), no como parte del build o del deploy. Idempotente. Configuración final: privado, 5 MB, solo `application/pdf`.

6. **Migración `20260726000000_fix_transporte_iva.sql` aplicada manualmente en Supabase SQL Editor.** Añade `base_imponible`, `pdf_storage_path`, `pdf_regeneracion_pendiente`, recalcula los presupuestos existentes, y aplica las políticas RLS del bucket. La aplicación NO accede al bucket con la sesión del usuario: el route handler comprueba primero el acceso al presupuesto con RLS y luego lee/escribe el objeto con `service_role`. Las políticas RLS del bucket son defensa en profundidad (evitar que una clave anónima filtrada pueda descargar PDFs).

7. **Aislamiento por operador NO aplicado.** El checklist original del Prompt 7 pedía "Sonia no puede descargar PDFs de presupuestos de otro operador", pero eso contradice las políticas RLS actuales (Prompt 2) que dan SELECT sobre todos los presupuestos a admin, operador y consulta. Claude Code hizo que el PDF se comporte igual que el resto de la interfaz (Sonia ya puede abrir cualquier presupuesto en la app). Si Espe/Mohamed quieren aislamiento estricto, es un cambio de RLS que afecta a listado, ficha y preview también. Documentado como nota 25 pendiente con Espe.

8. **Logo como placeholder profesional.** No hay ningún asset de marca en el repo, así que el PDF y el preview usan un disco azul-cyan (`#0c8aa3`) con la letra "A" blanca. Sustituirlo es cambiar un único archivo (`src/lib/pdf/logo.tsx`). Añadida nota 23 pendiente con Espe.

9. **PDFs de borradores se generan al vuelo, PDFs de emitidos se archivan en Storage.** Diseño intencional: un presupuesto en borrador puede cambiar hasta que se emita, por lo que archivarlo sería basura. Al emitir, se genera una vez y se archiva. Todas las descargas posteriores vienen de Storage (más rápido, y garantiza que el PDF entregado al cliente es exactamente el archivado). Si por diseño extraño un emitido se editara, se marca `pdf_regeneracion_pendiente = true` y la siguiente descarga regenera y reemplaza.

10. **Total autoritativo verificado en producción con presupuesto real 2026/000096/0:** cliente Doyle Náutica esporádico, línea DTF 120 uds pecho 9×4 sin extras → **59,54€ subtotal → 12,50€ IVA → 72,04€ total**. Coincide con el caso canónico documentado en CLAUDE.md sección 7.2 y con los 36 tests de `dtf.test.ts`.

**Estado de tests:** 220/220 tests passing (208 previos + 12 nuevos del cálculo de totales fiscales).

**Bugs visuales detectados (documentados en sección 13.8 para prompt de pulido):**
- Solapamiento del número del presupuesto con el título "PRESUPUESTO" en la cabecera del PDF.
- Topbar no marca visualmente la pestaña activa (Presupuestos, Clientes, Admin).

### Patch 7A — Pulido visual e integración del logo oficial

Aplicado inmediatamente tras Prompt 7 para dejar el sistema listo estéticamente antes de que Sonia haga presupuestos reales. Cambios acotados, sin nueva lógica de negocio.

**Decisiones técnicas:**

1. **Fix del solapamiento en la cabecera del PDF.** Título "PRESUPUESTO" reducido de 22pt a 18pt, `lineHeight` explícito en título y número, margen de 3pt aumentado a 6pt. Verificación técnica midiendo el content stream del PDF: caja del título ocupa 21,6pt y el bloque del número arranca en y=27,6 (6pt libres). Verificado con número corto (`2026/000090/0`) y número largo (`2026/999999/9`).

2. **Estado activo en la topbar.** Extraído sub-componente `EnlaceNav` en `Topbar.tsx` que usa `usePathname()`. Estilo: `border-b-2 border-ancora-primary` + `aria-current="page"` para accesibilidad. Activa también en subrutas: `/presupuestos/[id]` mantiene "Presupuestos" resaltado.

3. **Integración del logo oficial de Ancora Publicitat en 5 sitios:** PDF (cabecera), topbar de la app, pantalla de login, preview HTML y favicon. En el PDF se quitó el texto "Ancora Publicitat" del lado del logo porque el logo ya rotula.

4. **Compresión y saneamiento del PNG.** El logo entregado por Alan (`logo-ancora.png`) no tenía entrelazado óptimo: reprocesado y recomprimido de 15,5 KB a 10,1 KB (mismos píxeles, misma calidad). También tenía doble extensión (`logo-ancora.png.png`) que se corrigió al renombrar.

5. **Favicon generado desde el logo.** Script Node puro (sin dependencias) que recorta el rombo CMYK del logo. Se borró el `favicon.ico` por defecto de Next.js que tenía prioridad sobre `icon.png`.

6. **Configuración de `outputFileTracingIncludes` en `next.config.mjs`.** Descubierto durante el patch: los assets de `public/` no llegan a la lambda en Vercel (van al CDN, no al sistema de archivos de la función). Sin esta configuración, la generación del PDF en producción fallaría al buscar el logo. Verificado en el `.nft.json` del build que el logo entra en la traza de la ruta del PDF.

7. **Email corporativo aplicado:** `info@ancorapublicitat.es` en `src/lib/empresa.ts`. Aparece automáticamente en PDF y preview con formato `Email: …`.

8. **Test de embedding del logo en el PDF.** Añadido test que comprueba que el PDF embebe el logo como XObject 569×158. Es la garantía de que el logo REALMENTE está en el PDF (no solo referenciado). Dos tests de regresión adicionales para la cabecera. Total: **223/223 tests passing** (220 previos + 3 nuevos).

9. **Decisión de no parsear coordenadas del content stream en los tests.** Claude Code escribió inicialmente un test que parseaba las coordenadas del content stream del PDF para verificar el arreglo, pero lo descartó porque dependía de cómo emite react-pdf sus operadores y se rompería en cualquier actualización de la librería. El test permanente asserta el invariante de estilo (fuente, tamaños), que es lo que rompería quien vuelva a tocar la cabecera.

10. **Logo vectorial (SVG) sigue pendiente.** El PNG a 130pt de ancho imprime a ~111 ppp — bien en pantalla, aceptable en papel A4. Suficiente para operar. Nota 23 marcada como "parcialmente resuelta"; solicitar SVG a Espe cuando vuelva de vacaciones.

**Estado de tests:** 223/223 tests passing (220 previos + 3 nuevos del Patch 7A).

---

*Última actualización del documento: agosto 2026 tras cierre de Patch 7A. Sistema funcionalmente COMPLETO y visualmente pulido, listo para uso real.*
