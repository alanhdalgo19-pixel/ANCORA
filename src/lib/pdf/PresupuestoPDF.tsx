// PDF de presupuesto (CLAUDE.md sección 7.9).
//
// Equivalente en @react-pdf/renderer de `PresupuestoPreview.tsx`: mismo orden
// de bloques, mismos textos y mismos importes. El preview HTML sigue siendo la
// pantalla de trabajo; este componente es el documento que se envía al cliente.
//
// Es un componente PURO: recibe el presupuesto ya cargado y no toca Supabase.
// Todos los importes salen de las columnas guardadas (`base_imponible`,
// `iva_importe`, `total`) y de los snapshots `detalle_calculo` de cada línea:
// nada se recalcula aquí, por la regla de inmutabilidad de CLAUDE.md 7.6.

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { EMPRESA, FORMA_PAGO_RESUMEN, NOTAS_ESTANDAR } from "@/lib/empresa";
import { formatEuros, formatFecha } from "@/lib/format";
import {
  sublineasLogosComposicion,
  subdescripcionLinea,
  subdescripcionPrenda,
} from "@/lib/presupuestos/descripciones";
import type {
  Cliente,
  EstadoPresupuesto,
  Presupuesto,
  TipoCliente,
} from "@/types/database";
import type { LineaVista } from "@/types/presupuestos";
import { LogoAncora } from "./logo";
import { COLOR, COLUMNAS, estilos } from "./styles";

export interface PresupuestoPDFProps {
  presupuesto: Presupuesto;
  cliente: Cliente;
  nombreEmisor: string;
  lineas: LineaVista[];
  empresa: typeof EMPRESA;
}

const ETIQUETA_ESTADO: Record<EstadoPresupuesto, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  caducado: "Caducado",
};

const ETIQUETA_TIPO_CLIENTE: Record<TipoCliente, string> = {
  esporadico: "Cliente esporádico",
  habitual: "Cliente habitual",
};

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Cabecera({ presupuesto }: { presupuesto: Presupuesto }) {
  return (
    <View style={estilos.cabecera}>
      <View style={estilos.cabeceraIzquierda}>
        {/* El logo oficial ya rotula "ANCORA PUBLICITAT": no se repite en texto. */}
        <LogoAncora />
        <Text style={estilos.tenue}>
          {EMPRESA.localidad} · {EMPRESA.provincia}
        </Text>
      </View>

      <View style={estilos.cabeceraDerecha}>
        <Text style={estilos.titulo}>PRESUPUESTO</Text>
        <Text style={estilos.numero}>{presupuesto.numero}</Text>
        <Text style={[estilos.tenue, { marginTop: 5 }]}>
          Fecha de emisión: {formatFecha(presupuesto.fecha_emision)}
        </Text>
        <Text style={estilos.tenue}>
          Válido hasta: {formatFecha(presupuesto.fecha_validez)}
        </Text>
      </View>
    </View>
  );
}

function BandaBadges({
  presupuesto,
  cliente,
  nombreEmisor,
}: {
  presupuesto: Presupuesto;
  cliente: Cliente;
  nombreEmisor: string;
}) {
  return (
    <View style={estilos.bandaBadges}>
      <View style={estilos.gruposBadges}>
        <Text style={estilos.badge}>
          {ETIQUETA_ESTADO[presupuesto.estado].toUpperCase()}
        </Text>
        <Text style={[estilos.badge, estilos.badgePrimario]}>
          {ETIQUETA_TIPO_CLIENTE[cliente.tipo_cliente].toUpperCase()}
        </Text>
        {!cliente.activo && (
          <Text style={[estilos.badge, estilos.badgeAviso]}>
            CLIENTE INACTIVO
          </Text>
        )}
      </View>
      <Text style={estilos.tenue}>Emite: {nombreEmisor}</Text>
    </View>
  );
}

function BloqueDeYPara({
  empresa,
  cliente,
}: {
  empresa: typeof EMPRESA;
  cliente: Cliente;
}) {
  const localidadCliente = [cliente.codigo_postal, cliente.localidad]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={estilos.bloquesDePara}>
      <View style={estilos.columna}>
        <Text style={estilos.epigrafe}>DE</Text>
        <Text style={estilos.negrita}>{empresa.razon_social}</Text>
        <Text>N.I.F.: {empresa.nif}</Text>
        {empresa.direccion && <Text>{empresa.direccion}</Text>}
        <Text>
          {[empresa.codigo_postal, empresa.localidad]
            .filter(Boolean)
            .join(" ")}{" "}
          ({empresa.provincia})
        </Text>
        {empresa.telefono && <Text>Tfno.: {empresa.telefono}</Text>}
        {empresa.email && <Text>Email: {empresa.email}</Text>}
      </View>

      <View style={estilos.columna}>
        <Text style={estilos.epigrafe}>PARA</Text>
        <Text style={estilos.negrita}>{cliente.nombre}</Text>
        <Text>{cliente.cif ? `N.I.F.: ${cliente.cif}` : "CONTADO"}</Text>
        {cliente.direccion && <Text>{cliente.direccion}</Text>}
        {localidadCliente.length > 0 && (
          <Text>
            {localidadCliente}
            {cliente.provincia ? ` (${cliente.provincia})` : ""}
          </Text>
        )}
        {cliente.telefono && <Text>Tfno.: {cliente.telefono}</Text>}
        {cliente.email && <Text>{cliente.email}</Text>}
      </View>
    </View>
  );
}

function Comentario({
  cliente,
  notas,
}: {
  cliente: Cliente;
  notas: string | null;
}) {
  const contacto = [cliente.telefono, cliente.email].filter(Boolean).join(" · ");

  return (
    <View style={estilos.comentario}>
      {cliente.persona_contacto && (
        <Text>
          A la atención de{" "}
          <Text style={estilos.negrita}>{cliente.persona_contacto}</Text>
          {contacto ? ` · ${contacto}` : ""}
        </Text>
      )}
      {notas && <Text style={{ marginTop: 4 }}>{notas}</Text>}
    </View>
  );
}

function TablaLineas({ lineas }: { lineas: LineaVista[] }) {
  return (
    <View style={estilos.tabla}>
      {/* Sin `fixed`: repetiría la cabecera de la tabla en TODAS las páginas,
          incluida la de condiciones y firma, donde no hay ninguna línea. */}
      <View style={estilos.filaCabecera}>
        <Text style={[estilos.celdaCabecera, { width: COLUMNAS.descripcion }]}>
          Concepto
        </Text>
        <Text
          style={[
            estilos.celdaCabecera,
            estilos.celdaDerecha,
            { width: COLUMNAS.cantidad },
          ]}
        >
          Cant.
        </Text>
        <Text
          style={[
            estilos.celdaCabecera,
            estilos.celdaDerecha,
            { width: COLUMNAS.precio },
          ]}
        >
          Precio ud.
        </Text>
        <Text
          style={[
            estilos.celdaCabecera,
            estilos.celdaDerecha,
            { width: COLUMNAS.importe },
          ]}
        >
          Importe
        </Text>
      </View>

      {lineas.length === 0 && (
        <Text style={estilos.sinLineas}>Sin líneas todavía.</Text>
      )}

      {lineas.map((linea) => {
        const esExtra = linea.tipo_linea === "extra";
        const detalle =
          linea.tipo_linea === "prenda"
            ? subdescripcionPrenda(linea.detalle_calculo)
            : subdescripcionLinea(linea.detalle_calculo);
        // Una línea DTF compuesta enumera sus logos debajo, con el mismo
        // estilo indentado y atenuado que usan las líneas extra.
        const logos = sublineasLogosComposicion(linea.detalle_calculo);

        return (
          <View key={linea.id} style={estilos.fila} wrap={false}>
            <View style={{ width: COLUMNAS.descripcion }}>
              <Text style={esExtra ? estilos.descripcionExtra : undefined}>
                {esExtra ? `· ${linea.descripcion}` : linea.descripcion}
              </Text>
              {detalle && <Text style={estilos.subdescripcion}>{detalle}</Text>}
              {logos.map((logo) => (
                <Text key={logo} style={estilos.sublineaLogo}>
                  · {logo}
                </Text>
              ))}
            </View>
            <Text
              style={[
                estilos.celdaDerecha,
                estilos.atenuado,
                { width: COLUMNAS.cantidad },
              ]}
            >
              {esExtra ? "" : String(linea.cantidad)}
            </Text>
            <Text
              style={[
                estilos.celdaDerecha,
                estilos.atenuado,
                { width: COLUMNAS.precio },
              ]}
            >
              {esExtra ? "" : formatEuros(linea.precio_unitario)}
            </Text>
            <Text
              style={[estilos.celdaDerecha, { width: COLUMNAS.importe }]}
            >
              {formatEuros(linea.importe_linea)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Desglose fiscal. El transporte entra en la base imponible y tributa con el
 * resto (CLAUDE.md 13.6, corregido en el Prompt 7): por eso aparece ANTES de
 * la línea "Base imponible" y no después del IVA.
 */
function TotalesPDF({ presupuesto }: { presupuesto: Presupuesto }) {
  const descuentoImporte =
    (presupuesto.subtotal * presupuesto.descuento_manual_pct) / 100;

  return (
    <View style={estilos.zonaTotales} wrap={false}>
      <View style={estilos.totales}>
        <View style={estilos.filaTotal}>
          <Text style={estilos.etiquetaTotal}>Subtotal líneas</Text>
          <Text>{formatEuros(presupuesto.subtotal)}</Text>
        </View>

        {presupuesto.descuento_manual_pct > 0 && (
          <View style={estilos.filaTotal}>
            <Text style={estilos.etiquetaTotal}>
              Descuento ({presupuesto.descuento_manual_pct}%)
            </Text>
            {/* Guion ASCII, no el signo menos U+2212: las fuentes estándar de
                @react-pdf/renderer usan WinAnsi y ese carácter no existe ahí,
                así que el importe saldría sin signo. */}
            <Text>- {formatEuros(descuentoImporte)}</Text>
          </View>
        )}

        {presupuesto.transporte > 0 && (
          <View style={estilos.filaTotal}>
            <Text style={estilos.etiquetaTotal}>Transporte</Text>
            <Text>{formatEuros(presupuesto.transporte)}</Text>
          </View>
        )}

        <View style={[estilos.filaTotal, estilos.filaBase]}>
          <Text style={estilos.etiquetaTotal}>Base imponible</Text>
          <Text>{formatEuros(presupuesto.base_imponible)}</Text>
        </View>

        <View style={estilos.filaTotal}>
          <Text style={estilos.etiquetaTotal}>
            IVA ({presupuesto.iva_pct}%)
          </Text>
          <Text>{formatEuros(presupuesto.iva_importe)}</Text>
        </View>

        <View style={estilos.filaTotalFinal}>
          <Text style={estilos.etiquetaTotalFinal}>TOTAL</Text>
          <Text style={estilos.importeTotalFinal}>
            {formatEuros(presupuesto.total)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function NotasEstandar() {
  return (
    <View style={estilos.notas} wrap={false}>
      <Text style={estilos.epigrafe}>CONDICIONES</Text>
      {NOTAS_ESTANDAR.map((nota, indice) => (
        <View key={nota} style={estilos.nota}>
          <Text style={estilos.notaIndice}>{indice + 1}.</Text>
          <Text style={estilos.notaTexto}>{nota}</Text>
        </View>
      ))}
    </View>
  );
}

function DatosPagoYFirma({
  empresa,
  cliente,
}: {
  empresa: typeof EMPRESA;
  cliente: Cliente;
}) {
  return (
    <View style={estilos.pieBloques} wrap={false}>
      <View style={estilos.columna}>
        <Text style={estilos.epigrafe}>FORMA DE PAGO</Text>
        <Text style={estilos.atenuado}>{FORMA_PAGO_RESUMEN}</Text>
        {empresa.iban && (
          <Text style={[estilos.atenuado, { marginTop: 3 }]}>
            Transferencia{empresa.banco ? ` (${empresa.banco})` : ""} a IBAN:
          </Text>
        )}
        {empresa.iban && (
          <Text style={[estilos.negrita, { color: COLOR.textPrimary }]}>
            {empresa.iban}
          </Text>
        )}
        {cliente.condiciones_pago && (
          <Text style={[estilos.atenuado, { marginTop: 3 }]}>
            Condiciones acordadas: {cliente.condiciones_pago}
          </Text>
        )}
      </View>

      <View style={estilos.columna}>
        <Text style={estilos.epigrafe}>CONFORME, EL CLIENTE</Text>
        <Text style={estilos.tenue}>
          Nombre y cargo de quien acepta el presupuesto:
        </Text>
        <View style={estilos.lineaFirma}>
          <Text style={estilos.tenue}>Firma y sello · {cliente.nombre}</Text>
        </View>
        <Text style={[estilos.tenue, { marginTop: 8 }]}>Fecha:</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export function PresupuestoPDF({
  presupuesto,
  cliente,
  nombreEmisor,
  lineas,
  empresa,
}: PresupuestoPDFProps) {
  return (
    <Document
      title={`Presupuesto ${presupuesto.numero} · ${EMPRESA.nombre_comercial}`}
      author={empresa.razon_social}
      subject={`Presupuesto para ${cliente.nombre}`}
      creator={EMPRESA.nombre_comercial}
      producer={EMPRESA.nombre_comercial}
    >
      <Page size="A4" style={estilos.page}>
        <Cabecera presupuesto={presupuesto} />
        <BandaBadges
          presupuesto={presupuesto}
          cliente={cliente}
          nombreEmisor={nombreEmisor}
        />
        <BloqueDeYPara empresa={empresa} cliente={cliente} />
        {(cliente.persona_contacto || presupuesto.notas) && (
          <Comentario cliente={cliente} notas={presupuesto.notas} />
        )}
        <TablaLineas lineas={lineas} />
        <TotalesPDF presupuesto={presupuesto} />
        <NotasEstandar />
        <DatosPagoYFirma empresa={empresa} cliente={cliente} />

        <View style={estilos.paginacion} fixed>
          <Text>
            {empresa.razon_social} · N.I.F. {empresa.nif} · Presupuesto{" "}
            {presupuesto.numero}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
