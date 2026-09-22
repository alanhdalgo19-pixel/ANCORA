// F2.2 — rectángulo punteado del área imprimible dentro del mockup.
//
// Fragmento SVG sin estado: recibe el área ya calculada por
// `calcularLayoutMockup` y la pinta. La etiqueta ("PECHO", "ESPALDA"…) va
// justo encima del rectángulo para no tapar el logo, que arranca 2 cm por
// debajo del borde superior.

import type { AreaLayout } from "@/lib/mockup/calcular-layout";

interface AreaImprimibleProps {
  area: AreaLayout;
  color: string;
  tamanoFuentePx: number;
}

export function AreaImprimible({
  area,
  color,
  tamanoFuentePx,
}: AreaImprimibleProps) {
  return (
    <g aria-hidden="true">
      <rect
        x={area.x_px}
        y={area.y_px}
        width={area.ancho_px}
        height={area.alto_px}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeDasharray="4 3"
        rx={2}
      />
      <text
        x={area.x_px}
        y={area.y_px - tamanoFuentePx * 0.35}
        fill={color}
        fontSize={tamanoFuentePx}
        fontWeight={600}
        letterSpacing="0.05em"
      >
        {area.etiqueta}
      </text>
    </g>
  );
}
