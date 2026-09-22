// F2.2 — etiqueta "9 × 4 cm" bajo el logo del mockup.
//
// Lleva un halo del color de la prenda (`paint-order: stroke`) para que se lea
// aunque caiga encima de la línea punteada del área imprimible.

interface EtiquetaDimensionesProps {
  texto: string;
  x: number;
  y: number;
  tamanoFuentePx: number;
  color: string;
  colorHalo: string;
}

export function EtiquetaDimensiones({
  texto,
  x,
  y,
  tamanoFuentePx,
  color,
  colorHalo,
}: EtiquetaDimensionesProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={color}
      stroke={colorHalo}
      strokeWidth={3}
      paintOrder="stroke"
      fontSize={tamanoFuentePx}
      fontWeight={600}
    >
      {texto}
    </text>
  );
}
