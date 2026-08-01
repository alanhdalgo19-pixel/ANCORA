// Carga completa de un presupuesto (cabecera + cliente + emisor + líneas).
// La usan tanto la vista de detalle como la ruta de preview.

import type { createClient } from "@/lib/supabase/server";
import type { Cliente, Presupuesto } from "@/types/database";
import type { LineaVista } from "@/types/presupuestos";

type SupabaseServerClient = ReturnType<typeof createClient>;

export interface PresupuestoCompleto {
  presupuesto: Presupuesto;
  cliente: Cliente;
  nombreEmisor: string;
  lineas: LineaVista[];
}

function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export async function cargarPresupuestoCompleto(
  supabase: SupabaseServerClient,
  presupuestoId: string,
): Promise<PresupuestoCompleto | null> {
  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("id", presupuestoId)
    .maybeSingle();

  if (!presupuesto) return null;

  const [{ data: cliente }, { data: usuario }, { data: lineas }] =
    await Promise.all([
      supabase
        .from("clientes")
        .select("*")
        .eq("id", presupuesto.cliente_id)
        .maybeSingle(),
      supabase
        .from("usuarios")
        .select("nombre")
        .eq("id", presupuesto.usuario_id)
        .maybeSingle(),
      supabase
        .from("lineas_presupuesto")
        .select(
          "id, orden, tipo_linea, descripcion, cantidad, precio_unitario, importe_linea, detalle_calculo, linea_padre_id",
        )
        .eq("presupuesto_id", presupuestoId)
        .order("orden"),
    ]);

  if (!cliente) return null;

  return {
    presupuesto: {
      ...(presupuesto as Presupuesto),
      subtotal: num(presupuesto.subtotal),
      base_imponible: num(presupuesto.base_imponible),
      iva_pct: num(presupuesto.iva_pct),
      iva_importe: num(presupuesto.iva_importe),
      total: num(presupuesto.total),
      transporte: num(presupuesto.transporte),
      descuento_manual_pct: num(presupuesto.descuento_manual_pct),
    },
    cliente: {
      ...(cliente as Cliente),
      descuento_bordado_pct: num(cliente.descuento_bordado_pct),
    },
    // El usuario puede haberse desactivado; el presupuesto conserva la
    // trazabilidad aunque ya no exista la fila.
    nombreEmisor: (usuario?.nombre as string | undefined) ?? "Usuario dado de baja",
    lineas: (lineas ?? []).map((linea) => ({
      id: linea.id as string,
      orden: num(linea.orden),
      tipo_linea: linea.tipo_linea as LineaVista["tipo_linea"],
      descripcion: linea.descripcion as string,
      cantidad: num(linea.cantidad),
      precio_unitario: num(linea.precio_unitario),
      importe_linea: num(linea.importe_linea),
      detalle_calculo: linea.detalle_calculo,
      linea_padre_id: (linea.linea_padre_id as string | null) ?? null,
    })),
  };
}
