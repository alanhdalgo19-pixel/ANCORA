// Barra horizontal de distribución (Prompt 10).
//
// 100% Tailwind, sin librería de gráficos (decisión A.6 del prompt): el ancho
// va en `style` porque es un porcentaje calculado en tiempo de ejecución, y el
// color también, porque Tailwind no puede generar clases dinámicas y una barra
// por técnica con clase estática obligaría a un mapa de strings duplicado.

interface Props {
  etiqueta: string;
  /** Cifra que se muestra a la derecha, ya formateada. */
  valor: string;
  /** Proporción respecto al máximo de la lista, entre 0 y 1. */
  proporcion: number;
  /** Color de relleno en hexadecimal. */
  color: string;
  /** Texto pequeño bajo la barra (por ejemplo el % del total). */
  detalle?: string;
}

export function BarraSimple({
  etiqueta,
  valor,
  proporcion,
  color,
  detalle,
}: Props) {
  const porcentaje = Math.max(0, Math.min(1, proporcion)) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground" title={etiqueta}>
          {etiqueta}
        </span>
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {valor}
        </span>
      </div>

      <div
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${etiqueta}: ${valor}`}
      >
        {/* Ancho mínimo visible para que un valor pequeño pero distinto de
            cero no desaparezca del todo. */}
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: porcentaje > 0 ? `${Math.max(porcentaje, 1.5)}%` : "0%",
            backgroundColor: color,
          }}
        />
      </div>

      {detalle && (
        <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
      )}
    </div>
  );
}
