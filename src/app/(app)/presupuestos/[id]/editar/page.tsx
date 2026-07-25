import { redirect } from "next/navigation";

/**
 * La vista de detalle ya ES el editor cuando el presupuesto está en borrador
 * (tabla de líneas editable, notas, transporte, descuento). Mantener una
 * pantalla `/editar` aparte duplicaría la misma interfaz, así que esta ruta
 * existe por compatibilidad con los enlaces del enunciado y redirige al hub.
 */
export default function EditarPresupuestoPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/presupuestos/${params.id}`);
}
