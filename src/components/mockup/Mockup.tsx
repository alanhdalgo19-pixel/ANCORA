// F2.2 — mockup abstracto: el logo del cliente sobre una prenda a escala real.
//
// La prenda es un rectángulo neutro (modo abstracto; F2.4 traerá fotos reales)
// y el logo se coloca con sus medidas reales de estampación. Toda la geometría
// sale de `calcularLayoutMockup` —función pura y testeada—; aquí solo se pinta.
//
// Sin hooks ni estado: vale como Server o Client Component. F2.3 lo montará en
// el paso 4 del wizard y reutilizará el mismo layout para el PDF.
//
// El logo se carga con `<image href>`. Un SVG referenciado así se renderiza en
// modo estático seguro (sin scripts ni recursos externos), igual que con
// `<img>` en la biblioteca de logos (F2.1).

import { TriangleAlert } from "lucide-react";
import type { ColorGrupo, Ubicacion } from "@/lib/calculos/types";
import {
  ALTO_PIXELS_POR_DEFECTO,
  AVISO_UBICACION_NO_DISPONIBLE,
  calcularLayoutMockup,
} from "@/lib/mockup/calcular-layout";
import { AreaImprimible } from "./AreaImprimible";
import { EtiquetaDimensiones } from "./EtiquetaDimensiones";

const COLOR_EXCEDE = "#C62828";

export interface MockupProps {
  tipo_prenda: string;
  color_prenda?: ColorGrupo;
  /** URL del logo (p. ej. `/api/logos/{id}`), o null si aún no hay logo. */
  logo_url: string | null;
  logo_ancho_cm: number;
  logo_alto_cm: number;
  ubicacion: Ubicacion;
  alto_pixels?: number;
  mostrar_dimensiones?: boolean;
  mostrar_area_imprimible?: boolean;
}

export function Mockup({
  tipo_prenda,
  color_prenda = "blanco",
  logo_url,
  logo_ancho_cm,
  logo_alto_cm,
  ubicacion,
  alto_pixels = ALTO_PIXELS_POR_DEFECTO,
  mostrar_dimensiones = true,
  mostrar_area_imprimible = true,
}: MockupProps) {
  const layout = calcularLayoutMockup({
    tipo_prenda,
    color_prenda,
    logo_url,
    logo_ancho_cm,
    logo_alto_cm,
    ubicacion,
    alto_pixels,
  });

  const { prenda, area, logo } = layout;
  const fuente = layout.tamano_fuente_etiqueta_px;
  const fuenteTitulo = layout.tamano_fuente_titulo_px;
  const centroX = layout.svg_ancho_px / 2;

  const titulo =
    layout.vista === "trasera"
      ? `${prenda.nombre_visible} · VISTA TRASERA`
      : prenda.nombre_visible;
  const tituloY =
    layout.vista === "trasera"
      ? layout.banda_trasera_alto_px / 2 + fuenteTitulo * 0.35
      : fuenteTitulo * 1.4;

  const descripcion = logo
    ? `${prenda.nombre_visible} con logo de ${layout.etiqueta_dimensiones} en ${area.etiqueta.toLowerCase()}`
    : `${prenda.nombre_visible}: ${AVISO_UBICACION_NO_DISPONIBLE.toLowerCase()}`;

  return (
    <figure className="inline-flex flex-col items-center gap-3">
      <svg
        width={layout.svg_ancho_px}
        height={layout.svg_alto_px}
        viewBox={`0 0 ${layout.svg_ancho_px} ${layout.svg_alto_px}`}
        role="img"
        aria-label={descripcion}
        className="max-w-full"
      >
        {/* Prenda */}
        <rect
          x={0.5}
          y={0.5}
          width={layout.svg_ancho_px - 1}
          height={layout.svg_alto_px - 1}
          rx={layout.escala_px_por_cm * 1.5}
          fill={prenda.color_fondo}
          stroke={prenda.color_borde}
          strokeWidth={1}
        />

        {/* Banda que distingue la vista trasera */}
        {layout.vista === "trasera" && (
          <rect
            x={0.5}
            y={0.5}
            width={layout.svg_ancho_px - 1}
            height={layout.banda_trasera_alto_px}
            fill={prenda.color_texto}
            fillOpacity={0.08}
          />
        )}

        <text
          x={centroX}
          y={tituloY}
          textAnchor="middle"
          fill={prenda.color_texto}
          fontSize={fuenteTitulo}
          fontWeight={600}
        >
          {titulo}
        </text>

        {area.disponible && mostrar_area_imprimible && (
          <AreaImprimible
            area={area}
            color={prenda.color_texto_suave}
            tamanoFuentePx={fuente}
          />
        )}

        {!area.disponible && (
          <text
            x={centroX}
            y={layout.svg_alto_px / 2}
            textAnchor="middle"
            fill={prenda.color_texto_suave}
            fontSize={fuente}
          >
            <tspan x={centroX}>Ubicación no disponible</tspan>
            <tspan x={centroX} dy="1.3em">
              para este tipo de prenda
            </tspan>
          </text>
        )}

        {logo && (
          <g>
            {logo.tiene_url && logo.url ? (
              <image
                href={logo.url}
                x={logo.x_px}
                y={logo.y_px}
                width={logo.ancho_px}
                height={logo.alto_px}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <>
                <rect
                  x={logo.x_px}
                  y={logo.y_px}
                  width={logo.ancho_px}
                  height={logo.alto_px}
                  fill={prenda.color_texto}
                  fillOpacity={0.06}
                  stroke={prenda.color_texto_suave}
                  strokeDasharray="3 2"
                />
                <text
                  x={logo.x_px + logo.ancho_px / 2}
                  y={logo.y_px + logo.alto_px / 2 + fuente * 0.35}
                  textAnchor="middle"
                  fill={prenda.color_texto_suave}
                  // "Sin logo cargado" mide ~9 em: en logos pequeños la fuente
                  // se reduce para que el texto no se salga de la caja.
                  fontSize={Math.min(fuente * 0.8, logo.ancho_px / 9.5)}
                >
                  Sin logo cargado
                </text>
              </>
            )}

            {logo.excede_area && (
              <rect
                x={logo.x_px}
                y={logo.y_px}
                width={logo.ancho_px}
                height={logo.alto_px}
                fill="none"
                stroke={COLOR_EXCEDE}
                strokeWidth={2}
              />
            )}

            {mostrar_dimensiones && (
              <EtiquetaDimensiones
                texto={layout.etiqueta_dimensiones}
                x={logo.etiqueta_x_px}
                y={logo.etiqueta_y_px}
                tamanoFuentePx={fuente}
                color={logo.excede_area ? COLOR_EXCEDE : prenda.color_texto}
                colorHalo={prenda.color_fondo}
              />
            )}
          </g>
        )}
      </svg>

      {layout.warnings.length > 0 && (
        <figcaption className="w-full max-w-sm space-y-1">
          {layout.warnings.map((aviso) => (
            <p
              key={aviso}
              role="status"
              className="flex items-start gap-1.5 text-sm text-danger"
            >
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {aviso}
            </p>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
