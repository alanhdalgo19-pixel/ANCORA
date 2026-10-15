// F2.3 — mockup de una línea dentro del PDF de presupuesto.
//
// Redibuja con primitivos de @react-pdf/renderer (View, Text, Image) el mismo
// mockup que `<Mockup>` pinta en SVG en el navegador (CLAUDE.md, nota crítica
// 29, opción Y: sin rasterizar, sin dependencias nuevas). La geometría sale de
// `calcularLayoutMockup` en unidad "pt", así que las posiciones son las mismas
// que en pantalla, solo que a otra escala. No pretende ser idéntico píxel a
// píxel: es una vista simplificada para el documento del cliente.
//
// Componente PURO: recibe el bloque `mockup` del snapshot y, si hay, la URL (o
// el binario) del logo ya resuelta. No toca Supabase.
//
// `Image` de @react-pdf/renderer solo admite PNG y JPG. Un logo en PDF o en SVG
// se dibuja como caja punteada y se nombra el archivo debajo.
//
// F2.4 — con `foto`, la prenda es la foto real del catálogo y el logo va
// encima con superposición alpha simple: el PDF no tiene un equivalente fiable
// de `mix-blend-mode: multiply`, así que se ve algo más "pegado" que en el
// navegador (compromiso aceptado, nota 33). Sin foto, rectángulo de F2.3 y SIN
// aviso: el cliente no tiene por qué saber que faltan fotos.

import { Image, Text, View } from "@react-pdf/renderer";
import { calcularLayoutMockup } from "@/lib/mockup/calcular-layout";
import {
  formatoRasterizable,
  type MockupSnapshot,
} from "@/lib/mockup/snapshot";
import { formatMedida } from "@/lib/format";
import { NOMBRE_POSICION } from "@/lib/presupuestos/descripciones";
import { COLOR } from "./styles";

/** Logo ya resuelto para pintar: URL firmada del bucket o binario (tests). */
export type FuenteLogoPDF = string | Buffer;

/** F2.4 — foto de prenda ya resuelta (PNG/JPG) para el PDF. */
export interface FotoPrendaPDF {
  /** URL firmada del bucket o binario (tests). */
  fuente: string | Buffer;
  ancho_px: number | null;
  alto_px: number | null;
}

/** Clave de `fotosMockup`: una foto por prenda y grupo de color. */
export function claveFotoMockup(prendaId: string, color: string): string {
  return `${prendaId}:${color}`;
}

interface Props {
  mockup: MockupSnapshot;
  /** null si no hay logo, si su formato no es PNG/JPG o si ya no existe. */
  fuenteLogo: FuenteLogoPDF | null;
  /** null si la prenda no tiene foto (o no es PNG/JPG): rectángulo abstracto. */
  foto?: FotoPrendaPDF | null;
  anchoPt?: number;
}

const ANCHO_PT = 180;

/** Texto bajo el mockup cuando el logo no se ha podido incrustar. */
function notaLogoNoIncrustado(mockup: MockupSnapshot): string | null {
  if (!mockup.logo_id) return null;
  const nombre = mockup.logo_nombre ?? "Logo del cliente";
  if (mockup.logo_formato === "pdf") return `${nombre} (Logo en PDF — ver original)`;
  if (!formatoRasterizable(mockup.logo_formato)) {
    return `${nombre} (Logo vectorial — ver original)`;
  }
  return null;
}

export function MockupPDF({
  mockup,
  fuenteLogo,
  foto = null,
  anchoPt = ANCHO_PT,
}: Props) {
  // En composición DTF se pinta el primer logo y debajo se listan todos
  // (multi-mockup queda para F2.4).
  const primero = mockup.logos[0];
  if (!primero) return null;

  const layout = calcularLayoutMockup({
    tipo_prenda: mockup.tipo_prenda,
    color_prenda: mockup.color_prenda,
    logo_url: typeof fuenteLogo === "string" ? fuenteLogo : null,
    logo_ancho_cm: primero.ancho_cm,
    logo_alto_cm: primero.alto_cm,
    ubicacion: primero.ubicacion,
    unidad: "pt",
    ancho_pt: anchoPt,
    // El layout solo necesita saber que hay foto y su proporción; lo que se
    // pinta es `foto.fuente`, que en los tests es un binario y no una URL.
    foto: foto
      ? {
          url: typeof foto.fuente === "string" ? foto.fuente : "binario",
          ancho_px: foto.ancho_px,
          alto_px: foto.alto_px,
        }
      : null,
  });

  const { prenda, area, logo } = layout;
  const conFoto = layout.foto !== null && foto !== null;
  const fuente = layout.tamano_fuente_etiqueta_px;
  const fuenteTitulo = layout.tamano_fuente_titulo_px;
  const titulo =
    layout.vista === "trasera"
      ? `${prenda.nombre_visible} · VISTA TRASERA`
      : prenda.nombre_visible;

  const nota = notaLogoNoIncrustado(mockup);
  const incrustado = fuenteLogo !== null && nota === null;

  return (
    <View style={{ width: layout.svg_ancho_px, marginTop: 6 }} wrap={false}>
      <View
        style={{
          position: "relative",
          width: layout.svg_ancho_px,
          height: layout.svg_alto_px,
          backgroundColor: prenda.color_fondo,
          borderWidth: 0.75,
          borderColor: prenda.color_borde,
          borderRadius: conFoto ? 0 : layout.escala_px_por_cm * 1.5,
        }}
      >
        {conFoto && foto && (
          // eslint-disable-next-line jsx-a11y/alt-text -- `Image` de react-pdf no admite alt
          <Image
            src={foto.fuente}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: layout.svg_ancho_px - 1.5,
              height: layout.svg_alto_px - 1.5,
              objectFit: "cover",
            }}
          />
        )}

        {layout.vista === "trasera" && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: layout.banda_trasera_alto_px,
              // Con foto (delantera), la banda tapa casi del todo para dejar
              // claro que el logo va detrás.
              backgroundColor: conFoto ? prenda.color_fondo : prenda.color_texto,
              opacity: conFoto ? 0.85 : 0.08,
            }}
          />
        )}

        {(!conFoto || layout.vista === "trasera") && (
          <Text
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top:
                layout.vista === "trasera"
                  ? (layout.banda_trasera_alto_px - fuenteTitulo) / 2
                  : fuenteTitulo * 0.5,
              textAlign: "center",
              fontFamily: "Helvetica-Bold",
              fontSize: fuenteTitulo,
              lineHeight: 1,
              color: prenda.color_texto,
            }}
          >
            {titulo}
          </Text>
        )}

        {area.disponible ? (
          <>
            <Text
              style={{
                position: "absolute",
                left: area.x_px,
                top: area.y_px - fuente * 1.15,
                fontFamily: "Helvetica-Bold",
                fontSize: fuente,
                lineHeight: 1,
                color: prenda.color_texto_suave,
              }}
            >
              {area.etiqueta}
            </Text>
            <View
              style={{
                position: "absolute",
                left: area.x_px,
                top: area.y_px,
                width: area.ancho_px,
                height: area.alto_px,
                borderWidth: 0.75,
                borderStyle: "dashed",
                borderColor: prenda.color_texto_suave,
                borderRadius: 1.5,
              }}
            />
          </>
        ) : (
          <Text
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: layout.svg_alto_px / 2 - fuente,
              textAlign: "center",
              fontSize: fuente,
              color: prenda.color_texto_suave,
            }}
          >
            Ubicación no disponible para este tipo de prenda
          </Text>
        )}

        {logo && (
          <View
            style={{
              position: "absolute",
              left: logo.x_px,
              top: logo.y_px,
              width: logo.ancho_px,
              height: logo.alto_px,
              ...(incrustado
                ? {}
                : {
                    borderWidth: 0.75,
                    borderStyle: "dashed" as const,
                    borderColor: prenda.color_texto_suave,
                  }),
            }}
          >
            {incrustado && fuenteLogo !== null && (
              // `Image` de @react-pdf/renderer, no un <img> de HTML: no admite
              // `alt` (mismo caso que `LogoAncora` en ./logo.tsx).
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image
                src={fuenteLogo}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            )}
          </View>
        )}

        {logo?.excede_area && (
          <View
            style={{
              position: "absolute",
              left: logo.x_px,
              top: logo.y_px,
              width: logo.ancho_px,
              height: logo.alto_px,
              borderWidth: 1.5,
              borderColor: COLOR.danger,
            }}
          />
        )}

        {logo && (
          <Text
            style={{
              position: "absolute",
              // Caja ancha centrada en la etiqueta: @react-pdf no tiene
              // `textAnchor`, así que se centra el texto dentro de ella.
              left: logo.etiqueta_x_px - 50,
              width: 100,
              top: logo.etiqueta_y_px - fuente,
              textAlign: "center",
              fontFamily: "Helvetica-Bold",
              fontSize: fuente,
              lineHeight: 1,
              color: logo.excede_area ? COLOR.danger : prenda.color_texto,
            }}
          >
            {layout.etiqueta_dimensiones}
          </Text>
        )}
      </View>

      {nota && <Text style={notaEstilo}>{nota}</Text>}
      {!mockup.logo_id && <Text style={notaEstilo}>Sin logo seleccionado</Text>}

      {mockup.logos.length > 1 &&
        mockup.logos.map((logoLista, indice) => (
          <Text key={indice} style={notaEstilo}>
            Logo {indice + 1}: {NOMBRE_POSICION[logoLista.ubicacion].toLowerCase()}{" "}
            {formatMedida(logoLista.ancho_cm)} × {formatMedida(logoLista.alto_cm)} cm
          </Text>
        ))}
    </View>
  );
}

const notaEstilo = {
  fontSize: 7,
  color: COLOR.textTertiary,
  marginTop: 2,
};
