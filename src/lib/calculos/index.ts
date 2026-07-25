// Motor de cálculo del Proyecto Áncora (CLAUDE.md sección 7).
//
// Todas las funciones son PURAS: reciben inputs y configuración por argumento,
// no consultan Supabase ni dependen de Next.js. Quien las llame (el wizard de
// presupuesto, Prompt 6) es responsable de cargar los parámetros de la base de
// datos y de filtrar `tramos_margen` por técnica y tipo de cliente.

export {
  calcularDTF,
  type DtfInput,
  type DtfConfig,
  type DtfDetalleCalculo,
  type DtfResultado,
} from "./dtf";

export { componerDTF } from "./composicion-dtf";

export {
  calcularBordado,
  type BordadoInput,
  type BordadoConfig,
  type BordadoDetalleCalculo,
  type BordadoResultado,
  type TarifaBordado,
  type UnidadMedidaBordado,
  type CodigoPicaje,
} from "./bordado";

export {
  calcularSerigrafia,
  type SerigrafiaInput,
  type SerigrafiaConfig,
  type SerigrafiaDetalleCalculo,
  type SerigrafiaResultado,
  type FilaTarifaSerigrafia,
} from "./serigrafia";

export {
  calcularImpresionDirecta,
  type ImpresionDirectaInput,
  type ImpresionDirectaConfig,
  type ImpresionDirectaResultado,
} from "./impresion-directa";

export {
  calcularSublimacion,
  type SublimacionInput,
  type SublimacionConfig,
  type SublimacionDetalleCalculo,
  type SublimacionResultado,
} from "./sublimacion";

export {
  redondear2,
  aplicarMinimoTrabajo,
  buscarTramoMargen,
  aplicarMargen,
  calcularExtras,
  construirSnapshot,
  etiquetarTramo,
  validarCantidad,
} from "./helpers";

export {
  VERSION_CALCULO,
  type CalculoResultado,
  type DetalleCalculo,
  type SnapshotComercial,
  type TramoMargen,
  type Extra,
  type TipoCliente,
  type Ubicacion,
  type UbicacionSerigrafia,
  type ColorGrupo,
  type CodigoTecnica,
  type LogoInput,
  type DtfComposicionConfig,
  type LogoColocado,
  type ComposicionResultado,
  type ComposicionSnapshot,
  type ComposicionDetalleCalculo,
  type SnapshotComposicion,
  type SnapshotComercialComposicion,
} from "./types";
