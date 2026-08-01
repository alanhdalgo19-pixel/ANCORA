// Tipos del dominio — reflejan el esquema de CLAUDE.md sección 6.
// Los nombres de tabla/columna se mantienen en snake_case (espejo de SQL).

export type Rol = "admin" | "operador" | "consulta";
export type TipoCliente = "esporadico" | "habitual";
export type TipoProveedor = "urgencia" | "precio" | "calidad";
export type Tejido = "algodon" | "poliester" | "mixto" | "neopreno";
export type CodigoTecnica =
  | "DTF"
  | "BORDADO"
  | "SERIGRAFIA"
  | "SUBLIMACION"
  | "IMPRESION_DIRECTA";
export type CodigoPicaje = "SENCILLO" | "MEDIO" | "COMPLEJO" | "PERSONALIZADO";
export type ColorGrupo = "blanco" | "color" | "oscuro";
export type Ubicacion = "pecho" | "espalda";
export type Posicion = "pecho" | "espalda" | "manga" | "gorra" | "otro";
export type UnidadMedidaBordado =
  | "por_puntada"
  | "por_100_puntadas"
  | "por_1000_puntadas";
export type EstadoPresupuesto =
  | "borrador"
  | "enviado"
  | "aceptado"
  | "rechazado"
  | "caducado";
export type TipoLinea = "prenda" | "tecnica" | "extra";

// --- Capa 1: datos maestros ---

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  cif: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  provincia: string | null;
  tipo_cliente: TipoCliente;
  descuento_bordado_pct: number;
  persona_contacto: string | null;
  condiciones_pago: string | null;
  activo: boolean;
  created_at: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  tipo: TipoProveedor | null;
  dias_entrega: number | null;
  activo: boolean;
}

export interface Prenda {
  id: string;
  codigo_interno: string;
  nombre: string;
  modelo: string | null;
  proveedor_id: string;
  tejido: Tejido;
  disponible_oscuro: boolean;
  descripcion: string | null;
  activo: boolean;
}

export interface Tecnica {
  id: string;
  codigo: CodigoTecnica;
  nombre: string;
  activa: boolean;
}

export interface TipoPicaje {
  id: string;
  codigo: CodigoPicaje;
  nombre: string;
  precio_base: number;
  editable_en_presupuesto: boolean;
}

// --- Capa 2: configuración de precios ---

export interface PrecioPrenda {
  id: string;
  prenda_id: string;
  color_grupo: ColorGrupo;
  tipo_cliente: TipoCliente;
  desde_cantidad: number;
  hasta_cantidad: number | null;
  precio: number;
}

export interface ParametrosDtf {
  id: number;
  ancho_rollo_cm: number;
  precio_metro: number;
  recorte_por_logo: number;
  mano_obra_por_minuto: number;
  preparacion_pct: number;
  minimo_trabajo: number;
  margen_seguridad_cm: number;
  minutos_setup_fijo: number;
  minutos_por_logo: number;
}

export interface ParametrosBordado {
  id: number;
  precio_tarifa_1: number;
  precio_tarifa_2: number;
  precio_tarifa_3: number;
  precio_personalizable_default: number;
  unidad_medida: UnidadMedidaBordado;
  minimo_pieza: number;
  minimo_trabajo: number;
}

export interface TarifaSerigrafia {
  id: string;
  tipo_cliente: TipoCliente;
  ubicacion: Ubicacion;
  num_colores: number;
  desde_cantidad: number;
  hasta_cantidad: number;
  precio_unitario: number;
}

export interface ParametrosSerigrafia {
  id: number;
  recargo_oscura_pecho_por_color: number;
  recargo_oscura_espalda_por_color: number;
  fotolito_pecho: number;
  fotolito_espalda: number;
  minimo_trabajo: number;
  pantone_por_color: number;
  vectorizacion: number;
}

export interface ParametrosImpresionDirecta {
  id: number;
  usa_tarifa_serigrafia: boolean;
  solo_algodon: boolean;
  minimo_trabajo: number;
}

export interface ParametrosSublimacion {
  id: number;
  precio_unitario_base: number | null;
  cantidad_minima: number | null;
  tasa_merma_pct: number | null;
  solo_blanco_poliester: boolean;
}

export interface TramoMargen {
  id: string;
  tecnica_id: string;
  tipo_cliente: TipoCliente;
  desde_cantidad: number;
  hasta_cantidad: number | null;
  margen_pct: number;
}

export interface CosteOperativo {
  clave: string;
  valor: number | null;
  descripcion: string | null;
}

// --- Capa 3: transacciones ---

export interface Presupuesto {
  id: string;
  numero: string;
  cliente_id: string;
  usuario_id: string;
  fecha_emision: string;
  fecha_validez: string;
  estado: EstadoPresupuesto;
  /** Suma bruta de líneas: sin descuento manual y sin transporte. */
  subtotal: number;
  /** subtotal − descuento + transporte. Base sobre la que se calcula el IVA. */
  base_imponible: number;
  iva_pct: number;
  iva_importe: number;
  total: number;
  transporte: number;
  descuento_manual_pct: number;
  notas: string | null;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  /** Ruta en el bucket `presupuestos-pdf`; null mientras sea borrador. */
  pdf_storage_path: string | null;
  pdf_regeneracion_pendiente: boolean;
}

export interface LineaPresupuesto {
  id: string;
  presupuesto_id: string;
  orden: number;
  tipo_linea: TipoLinea;
  prenda_id: string | null;
  tecnica_id: string | null;
  descripcion: string;
  cantidad: number;
  color: string | null;
  color_grupo: ColorGrupo | null;
  ancho_logo_cm: number | null;
  alto_logo_cm: number | null;
  posicion: Posicion | null;
  puntadas: number | null;
  num_colores: number | null;
  prenda_oscura: boolean | null;
  tipo_picaje_id: string | null;
  coste_interno: number;
  margen_aplicado_pct: number;
  precio_unitario: number;
  importe_linea: number;
  detalle_calculo: unknown;
}
