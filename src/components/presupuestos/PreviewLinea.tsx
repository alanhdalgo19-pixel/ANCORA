import { formatEuros } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { FilaPreviewLinea, PreviewLinea as DatosPreviewLinea } from "@/types/presupuestos";

function Fila({
  fila,
  destacada = false,
  matiz,
}: {
  fila: FilaPreviewLinea;
  destacada?: boolean;
  matiz?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p
          className={
            destacada
              ? "text-sm font-medium text-foreground"
              : "text-sm text-foreground"
          }
        >
          {fila.descripcion}
        </p>
        {(fila.detalle || matiz) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[matiz, fila.detalle].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-foreground">
          {formatEuros(fila.importe)}
        </p>
        <p className="text-xs text-muted-foreground">
          {fila.cantidad} × {formatEuros(fila.precio_unitario)}
        </p>
      </div>
    </div>
  );
}

/** Resumen del paso 5: qué se va a añadir al presupuesto y cómo se ha calculado. */
export function PreviewLinea({ preview }: { preview: DatosPreviewLinea }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border">
        <div className="divide-y divide-border px-4">
          {preview.prenda && (
            <Fila
              fila={preview.prenda}
              matiz="Venta de prenda"
              destacada
            />
          )}
          <Fila fila={preview.tecnica} matiz="Personalización" destacada />
          {preview.extras.map((extra) => (
            <Fila key={extra.descripcion} fila={extra} matiz="Extra" />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            Total de la línea (sin IVA)
          </span>
          <span className="text-base font-semibold text-ancora-primary">
            {formatEuros(preview.total)}
          </span>
        </div>
      </div>

      {preview.prenda_sin_precio && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          La prenda seleccionada tiene precio 0,00 € configurado. Revisa la
          matriz de precios en Admin → Prendas antes de emitir.
        </p>
      )}

      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Ver desglose interno del cálculo
        </summary>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Coste interno
            </dt>
            <dd className="mt-0.5 text-foreground">
              {formatEuros(preview.desglose.coste_interno)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Margen aplicado
            </dt>
            <dd className="mt-0.5 text-foreground">
              {preview.desglose.margen_pct}%
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Tramo
            </dt>
            <dd className="mt-0.5 text-foreground">
              {preview.desglose.tramo_cantidad} uds
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Mínimo de trabajo
            </dt>
            <dd className="mt-0.5">
              {preview.desglose.aplicado_minimo ? (
                <Badge
                  variant="outline"
                  className="border-warning/30 bg-warning/10 text-warning"
                >
                  Aplicado
                </Badge>
              ) : (
                <span className="text-muted-foreground">No aplicado</span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          El importe de la línea es el valor autoritativo; el precio unitario se
          muestra redondeado a céntimos, así que su multiplicación puede diferir
          en unos céntimos del total.
        </p>
      </details>
    </div>
  );
}
