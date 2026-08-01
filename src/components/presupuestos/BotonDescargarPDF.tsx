import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nombreArchivoPDF } from "@/lib/pdf/nombres";
import type { EstadoPresupuesto } from "@/types/database";

interface Props {
  presupuestoId: string;
  numero: string;
  estado: EstadoPresupuesto;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  /** Solo icono, para la columna de acciones del listado. */
  soloIcono?: boolean;
}

/**
 * Enlace de descarga al route handler `/api/presupuestos/{id}/pdf`.
 *
 * Es un `<a>` normal y no un botón con `fetch`: la respuesta llega con
 * `Content-Disposition: attachment` y el navegador se encarga de la descarga
 * sin necesidad de JavaScript. `download` fija el nombre del archivo también
 * cuando el navegador decide abrirlo en su visor.
 *
 * Un borrador todavía puede cambiar, así que se etiqueta como tal: el PDF que
 * se descarga es una foto del momento, no el documento definitivo.
 */
export function BotonDescargarPDF({
  presupuestoId,
  numero,
  estado,
  variant = "outline",
  size = "default",
  soloIcono = false,
}: Props) {
  const esBorrador = estado === "borrador";
  const etiqueta = esBorrador ? "Descargar PDF (borrador)" : "Descargar PDF";

  return (
    <Button asChild variant={variant} size={size}>
      <Link
        href={`/api/presupuestos/${presupuestoId}/pdf`}
        prefetch={false}
        download={nombreArchivoPDF(numero)}
        title={soloIcono ? etiqueta : undefined}
        aria-label={soloIcono ? `${etiqueta} del ${numero}` : undefined}
      >
        <Download className="h-4 w-4" />
        {!soloIcono && etiqueta}
      </Link>
    </Button>
  );
}
