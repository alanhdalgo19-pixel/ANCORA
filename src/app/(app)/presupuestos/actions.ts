"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUserRole } from "@/lib/supabase/server";
import { redondear2 } from "@/lib/calculos";
import {
  DIAS_VALIDEZ_PRESUPUESTO,
  PRIMER_NUMERO_2026,
} from "@/lib/empresa";
import { hoyISO, sumarDiasISO } from "@/lib/format";
import {
  calcularLinea,
  ErrorCalculo,
  type FilaLineaCalculada,
} from "@/lib/presupuestos/calcular-linea";
import type { EstadoPresupuesto, Rol } from "@/types/database";
import type {
  DatosLineaWizard,
  PreviewLinea,
  ResultadoAccion,
} from "@/types/presupuestos";

type SupabaseServerClient = ReturnType<typeof createClient>;

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Sesión y permisos
// ---------------------------------------------------------------------------

interface Sesion {
  usuarioId: string;
  rol: Rol;
}

async function cargarSesion(): Promise<Sesion | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rol = await getUserRole();
  if (!rol) return null;

  return { usuarioId: user.id, rol };
}

/**
 * Comprueba que hay sesión y que el rol puede crear o modificar presupuestos.
 * `consulta` es solo lectura (CLAUDE.md sección 2). RLS ya lo impediría, pero
 * la Server Action devuelve un mensaje entendible en vez de un error de base
 * de datos.
 */
async function sesionEditora(): Promise<
  { ok: true; sesion: Sesion } | { ok: false; error: string }
> {
  const sesion = await cargarSesion();
  if (!sesion) return fallo("Tu sesión ha caducado. Vuelve a entrar.");
  if (sesion.rol === "consulta") {
    return fallo("Tu usuario solo tiene permisos de consulta.");
  }
  return { ok: true, sesion };
}

// ---------------------------------------------------------------------------
// Numeración (CLAUDE.md 7.7)
// ---------------------------------------------------------------------------

function formatearNumero(anio: number, secuencia: number): string {
  return `${anio}/${String(secuencia).padStart(6, "0")}/0`;
}

/**
 * Siguiente número libre del año en curso, formato `AAAA/NNNNNN/0`.
 *
 * Al ser secuencia de 6 dígitos con ceros a la izquierda, el orden
 * lexicográfico coincide con el numérico, así que basta con leer el mayor.
 * El primer presupuesto de 2026 arranca en el 90 porque Ancora ya iba por el
 * ~88 en su software anterior.
 */
export async function calcularNumeroPresupuesto(): Promise<string> {
  const supabase = createClient();
  return siguienteNumero(supabase);
}

async function siguienteNumero(
  supabase: SupabaseServerClient,
): Promise<string> {
  const anio = new Date().getFullYear();

  const { data } = await supabase
    .from("presupuestos")
    .select("numero")
    .like("numero", `${anio}/%`)
    .order("numero", { ascending: false })
    .limit(1);

  const ultimo = data?.[0]?.numero as string | undefined;
  if (!ultimo) {
    return formatearNumero(anio, anio === 2026 ? PRIMER_NUMERO_2026 : 1);
  }

  const secuencia = Number.parseInt(ultimo.split("/")[1] ?? "0", 10);
  return formatearNumero(anio, (Number.isNaN(secuencia) ? 0 : secuencia) + 1);
}

// ---------------------------------------------------------------------------
// Totales (CLAUDE.md Parte D del Prompt 6)
// ---------------------------------------------------------------------------

/**
 * Recalcula subtotal, IVA y total a partir de las líneas guardadas.
 * `subtotal` es la suma bruta de líneas; el descuento manual se aplica encima,
 * y el transporte se suma después del IVA porque no lo lleva.
 */
async function recalcularTotales(
  supabase: SupabaseServerClient,
  presupuestoId: string,
): Promise<void> {
  const [{ data: lineas }, { data: presupuesto }] = await Promise.all([
    supabase
      .from("lineas_presupuesto")
      .select("importe_linea")
      .eq("presupuesto_id", presupuestoId),
    supabase
      .from("presupuestos")
      .select("iva_pct, transporte, descuento_manual_pct")
      .eq("id", presupuestoId)
      .single(),
  ]);

  if (!presupuesto) return;

  const subtotal = redondear2(
    (lineas ?? []).reduce((suma, linea) => suma + Number(linea.importe_linea), 0),
  );
  const descuentoPct = Number(presupuesto.descuento_manual_pct) || 0;
  const base = redondear2(subtotal * (1 - descuentoPct / 100));
  const ivaImporte = redondear2(base * (Number(presupuesto.iva_pct) / 100));
  const total = redondear2(
    base + ivaImporte + (Number(presupuesto.transporte) || 0),
  );

  await supabase
    .from("presupuestos")
    .update({ subtotal, iva_importe: ivaImporte, total })
    .eq("id", presupuestoId);
}

// ---------------------------------------------------------------------------
// Presupuesto
// ---------------------------------------------------------------------------

interface PresupuestoEditable {
  id: string;
  estado: EstadoPresupuesto;
  cliente_id: string;
}

async function cargarPresupuestoEditable(
  supabase: SupabaseServerClient,
  presupuestoId: string,
): Promise<
  { ok: true; presupuesto: PresupuestoEditable } | { ok: false; error: string }
> {
  const { data } = await supabase
    .from("presupuestos")
    .select("id, estado, cliente_id")
    .eq("id", presupuestoId)
    .single();

  if (!data) return fallo("No se ha encontrado el presupuesto.");
  if (data.estado !== "borrador") {
    return fallo(
      "Este presupuesto ya no es un borrador: no se pueden modificar sus líneas.",
    );
  }
  return { ok: true, presupuesto: data as PresupuestoEditable };
}

export async function crearPresupuesto(datos: {
  cliente_id: string;
}): Promise<ResultadoAccion<{ presupuesto_id: string; numero: string }>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", datos.cliente_id)
    .single();
  if (!cliente) return fallo("El cliente seleccionado no existe.");

  const { data: costeIva } = await supabase
    .from("costes_operativos")
    .select("valor")
    .eq("clave", "iva_estandar")
    .maybeSingle();
  const ivaPct = Number(costeIva?.valor ?? 21) || 21;

  const emision = hoyISO();
  const validez = sumarDiasISO(emision, DIAS_VALIDEZ_PRESUPUESTO);

  // El número es único por año: si dos usuarios crean a la vez, uno choca con
  // la restricción UNIQUE y reintenta con el siguiente libre.
  for (let intento = 0; intento < 5; intento += 1) {
    const numero = await siguienteNumero(supabase);
    const { data, error } = await supabase
      .from("presupuestos")
      .insert({
        numero,
        cliente_id: datos.cliente_id,
        usuario_id: permiso.sesion.usuarioId,
        fecha_emision: emision,
        fecha_validez: validez,
        estado: "borrador",
        subtotal: 0,
        iva_pct: ivaPct,
        iva_importe: 0,
        total: 0,
      })
      .select("id, numero")
      .single();

    if (!error && data) {
      revalidatePath("/presupuestos");
      return {
        ok: true,
        datos: { presupuesto_id: data.id as string, numero: data.numero as string },
      };
    }

    // 23505 = unique_violation; cualquier otro error no se resuelve con otro número.
    if (error?.code !== "23505") {
      return fallo("No se ha podido crear el presupuesto. Inténtalo de nuevo.");
    }
  }

  return fallo(
    "No se ha podido asignar un número de presupuesto libre. Inténtalo de nuevo.",
  );
}

/** Alta rápida de cliente desde el paso 1 del wizard (solo 3 campos). */
export async function crearClienteRapido(datos: {
  nombre: string;
  cif: string | null;
  telefono: string | null;
}): Promise<ResultadoAccion<{ cliente_id: string; nombre: string }>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  if (!datos.nombre.trim()) return fallo("El nombre del cliente es obligatorio.");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nombre: datos.nombre.trim(),
      cif: datos.cif?.trim() || null,
      telefono: datos.telefono?.trim() || null,
      provincia: "Illes Balears",
    })
    .select("id, nombre")
    .single();

  if (error || !data) {
    return fallo("No se ha podido crear el cliente. Inténtalo de nuevo.");
  }

  revalidatePath("/clientes");
  return {
    ok: true,
    datos: { cliente_id: data.id as string, nombre: data.nombre as string },
  };
}

export async function actualizarPresupuesto(datos: {
  presupuesto_id: string;
  notas?: string | null;
  transporte?: number;
  descuento_manual_pct?: number;
}): Promise<ResultadoAccion<null>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();
  const editable = await cargarPresupuestoEditable(supabase, datos.presupuesto_id);
  if (!editable.ok) return editable;

  const cambios: Record<string, unknown> = {};
  if (datos.notas !== undefined) cambios.notas = datos.notas?.trim() || null;

  if (datos.transporte !== undefined) {
    if (!Number.isFinite(datos.transporte) || datos.transporte < 0) {
      return fallo("El transporte no puede ser negativo.");
    }
    cambios.transporte = redondear2(datos.transporte);
  }

  if (datos.descuento_manual_pct !== undefined) {
    const descuento = datos.descuento_manual_pct;
    if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
      return fallo("El descuento debe estar entre 0 y 100%.");
    }
    // El tope de `costes_operativos` limita a Sonia, no a Espe.
    if (permiso.sesion.rol === "operador") {
      const { data } = await supabase
        .from("costes_operativos")
        .select("valor")
        .eq("clave", "descuento_manual_max_pct")
        .maybeSingle();
      const maximo = Number(data?.valor ?? 100);
      if (Number.isFinite(maximo) && descuento > maximo) {
        return fallo(
          `El descuento máximo que puedes aplicar es ${maximo}%. Pídeselo a un administrador.`,
        );
      }
    }
    cambios.descuento_manual_pct = descuento;
  }

  if (Object.keys(cambios).length === 0) return { ok: true, datos: null };

  const { error } = await supabase
    .from("presupuestos")
    .update(cambios)
    .eq("id", datos.presupuesto_id);

  if (error) return fallo("No se han podido guardar los cambios.");

  await recalcularTotales(supabase, datos.presupuesto_id);
  revalidatePath(`/presupuestos/${datos.presupuesto_id}`);
  revalidatePath("/presupuestos");
  return { ok: true, datos: null };
}

// ---------------------------------------------------------------------------
// Líneas
// ---------------------------------------------------------------------------

async function cargarClienteDePresupuesto(
  supabase: SupabaseServerClient,
  clienteId: string,
) {
  const { data } = await supabase
    .from("clientes")
    .select("tipo_cliente, descuento_bordado_pct")
    .eq("id", clienteId)
    .single();
  return data as
    | { tipo_cliente: "esporadico" | "habitual"; descuento_bordado_pct: number }
    | null;
}

/** Calcula la línea sin guardarla: alimenta el paso 5 del wizard. */
export async function previsualizarLinea(
  presupuestoId: string,
  datos: DatosLineaWizard,
): Promise<ResultadoAccion<PreviewLinea>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();
  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select("cliente_id")
    .eq("id", presupuestoId)
    .single();

  if (!presupuesto) return fallo("No se ha encontrado el presupuesto.");

  const cliente = await cargarClienteDePresupuesto(
    supabase,
    presupuesto.cliente_id as string,
  );
  if (!cliente) return fallo("No se ha encontrado el cliente del presupuesto.");

  try {
    const calculada = await calcularLinea(supabase, datos, cliente);
    return { ok: true, datos: calculada.preview };
  } catch (error) {
    if (error instanceof ErrorCalculo) return fallo(error.message);
    return fallo("No se ha podido calcular la línea.");
  }
}

async function siguienteOrden(
  supabase: SupabaseServerClient,
  presupuestoId: string,
): Promise<number> {
  const { data } = await supabase
    .from("lineas_presupuesto")
    .select("orden")
    .eq("presupuesto_id", presupuestoId)
    .order("orden", { ascending: false })
    .limit(1);

  return (Number(data?.[0]?.orden ?? 0) || 0) + 1;
}

/**
 * Inserta el grupo de líneas que genera un paso del wizard.
 *
 * La línea de técnica es el ancla del grupo: la venta de prenda y los extras
 * cuelgan de ella con `linea_padre_id`, de modo que borrar la técnica arrastra
 * en cascada todo lo que la acompañaba. Por eso se inserta primero, aunque en
 * el PDF la prenda aparezca antes (el orden de impresión lo fija `orden`).
 */
async function insertarGrupoLineas(
  supabase: SupabaseServerClient,
  presupuestoId: string,
  ordenBase: number,
  grupo: {
    prenda: FilaLineaCalculada | null;
    tecnica: FilaLineaCalculada;
    extras: FilaLineaCalculada[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: tecnicaInsertada, error: errorTecnica } = await supabase
    .from("lineas_presupuesto")
    .insert({
      ...grupo.tecnica,
      presupuesto_id: presupuestoId,
      orden: ordenBase + 1,
      linea_padre_id: null,
    })
    .select("id")
    .single();

  if (errorTecnica || !tecnicaInsertada) {
    return fallo("No se ha podido guardar la línea. Inténtalo de nuevo.");
  }

  const padreId = tecnicaInsertada.id as string;
  const hijas: Record<string, unknown>[] = [];

  if (grupo.prenda) {
    hijas.push({
      ...grupo.prenda,
      presupuesto_id: presupuestoId,
      orden: ordenBase,
      linea_padre_id: padreId,
    });
  }
  grupo.extras.forEach((extra, indice) => {
    hijas.push({
      ...extra,
      presupuesto_id: presupuestoId,
      orden: ordenBase + 2 + indice,
      linea_padre_id: padreId,
    });
  });

  if (hijas.length) {
    const { error } = await supabase.from("lineas_presupuesto").insert(hijas);
    if (error) {
      // Deja el presupuesto como estaba: sin la línea a medio guardar.
      await supabase.from("lineas_presupuesto").delete().eq("id", padreId);
      return fallo("No se ha podido guardar la línea completa. Inténtalo de nuevo.");
    }
  }

  return { ok: true };
}

export async function añadirLinea(
  presupuestoId: string,
  datos: DatosLineaWizard,
): Promise<ResultadoAccion<null>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();
  const editable = await cargarPresupuestoEditable(supabase, presupuestoId);
  if (!editable.ok) return editable;

  const cliente = await cargarClienteDePresupuesto(
    supabase,
    editable.presupuesto.cliente_id,
  );
  if (!cliente) return fallo("No se ha encontrado el cliente del presupuesto.");

  let calculada;
  try {
    calculada = await calcularLinea(supabase, datos, cliente);
  } catch (error) {
    if (error instanceof ErrorCalculo) return fallo(error.message);
    return fallo("No se ha podido calcular la línea.");
  }

  const orden = await siguienteOrden(supabase, presupuestoId);
  const insercion = await insertarGrupoLineas(supabase, presupuestoId, orden, {
    prenda: calculada.prenda,
    tecnica: calculada.tecnica,
    extras: calculada.extras,
  });
  if (!insercion.ok) return insercion;

  await recalcularTotales(supabase, presupuestoId);
  revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/presupuestos");
  return { ok: true, datos: null };
}

/**
 * Recalcula una línea existente con datos nuevos. Se implementa como
 * "borrar y volver a insertar" en la misma posición: el grupo prenda +
 * técnica + extras puede cambiar de composición (activar picaje, quitar
 * vectorización…), así que actualizar en sitio obligaría a diffear filas.
 */
export async function editarLinea(
  lineaId: string,
  datos: DatosLineaWizard,
): Promise<ResultadoAccion<null>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();
  const { data: linea } = await supabase
    .from("lineas_presupuesto")
    .select("id, presupuesto_id, orden, tipo_linea")
    .eq("id", lineaId)
    .single();

  if (!linea) return fallo("No se ha encontrado la línea.");
  if (linea.tipo_linea !== "tecnica") {
    return fallo("Solo se pueden editar las líneas de personalización.");
  }

  const presupuestoId = linea.presupuesto_id as string;
  const editable = await cargarPresupuestoEditable(supabase, presupuestoId);
  if (!editable.ok) return editable;

  const cliente = await cargarClienteDePresupuesto(
    supabase,
    editable.presupuesto.cliente_id,
  );
  if (!cliente) return fallo("No se ha encontrado el cliente del presupuesto.");

  let calculada;
  try {
    calculada = await calcularLinea(supabase, datos, cliente);
  } catch (error) {
    if (error instanceof ErrorCalculo) return fallo(error.message);
    return fallo("No se ha podido calcular la línea.");
  }

  // La prenda ocupa `orden - 1`, así que el grupo nuevo arranca ahí.
  const ordenBase = Math.max(0, Number(linea.orden) - 1);

  const { error: errorBorrado } = await supabase
    .from("lineas_presupuesto")
    .delete()
    .eq("id", lineaId);
  if (errorBorrado) return fallo("No se ha podido actualizar la línea.");

  const insercion = await insertarGrupoLineas(
    supabase,
    presupuestoId,
    ordenBase,
    {
      prenda: calculada.prenda,
      tecnica: calculada.tecnica,
      extras: calculada.extras,
    },
  );
  if (!insercion.ok) return insercion;

  await recalcularTotales(supabase, presupuestoId);
  revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/presupuestos");
  return { ok: true, datos: null };
}

export async function eliminarLinea(
  lineaId: string,
): Promise<ResultadoAccion<null>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();
  const { data: linea } = await supabase
    .from("lineas_presupuesto")
    .select("id, presupuesto_id")
    .eq("id", lineaId)
    .single();

  if (!linea) return fallo("No se ha encontrado la línea.");

  const presupuestoId = linea.presupuesto_id as string;
  const editable = await cargarPresupuestoEditable(supabase, presupuestoId);
  if (!editable.ok) return editable;

  // ON DELETE CASCADE se lleva la prenda y los extras del grupo.
  const { error } = await supabase
    .from("lineas_presupuesto")
    .delete()
    .eq("id", lineaId);

  if (error) return fallo("No se ha podido eliminar la línea.");

  await recalcularTotales(supabase, presupuestoId);
  revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/presupuestos");
  return { ok: true, datos: null };
}

// ---------------------------------------------------------------------------
// Estados (CLAUDE.md 7.1)
// ---------------------------------------------------------------------------

const TRANSICIONES: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  borrador: ["enviado"],
  enviado: ["aceptado", "rechazado", "caducado"],
  aceptado: [],
  rechazado: [],
  caducado: [],
};

/** Marcar aceptado o rechazado es decisión comercial: solo admin. */
const ESTADOS_SOLO_ADMIN: EstadoPresupuesto[] = ["aceptado", "rechazado"];

export async function emitirPresupuesto(
  presupuestoId: string,
): Promise<ResultadoAccion<null>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();
  const editable = await cargarPresupuestoEditable(supabase, presupuestoId);
  if (!editable.ok) return editable;

  const { count } = await supabase
    .from("lineas_presupuesto")
    .select("id", { count: "exact", head: true })
    .eq("presupuesto_id", presupuestoId);

  if (!count) {
    return fallo("Añade al menos una línea antes de emitir el presupuesto.");
  }

  const { error } = await supabase
    .from("presupuestos")
    .update({ estado: "enviado", sent_at: new Date().toISOString() })
    .eq("id", presupuestoId);

  if (error) return fallo("No se ha podido emitir el presupuesto.");

  revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/presupuestos");
  return { ok: true, datos: null };
}

export async function cambiarEstadoPresupuesto(
  presupuestoId: string,
  nuevoEstado: EstadoPresupuesto,
): Promise<ResultadoAccion<null>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  if (
    ESTADOS_SOLO_ADMIN.includes(nuevoEstado) &&
    permiso.sesion.rol !== "admin"
  ) {
    return fallo(
      "Solo un administrador puede marcar un presupuesto como aceptado o rechazado.",
    );
  }

  const supabase = createClient();
  const { data: presupuesto } = await supabase
    .from("presupuestos")
    .select("estado")
    .eq("id", presupuestoId)
    .single();

  if (!presupuesto) return fallo("No se ha encontrado el presupuesto.");

  const estadoActual = presupuesto.estado as EstadoPresupuesto;
  if (!TRANSICIONES[estadoActual].includes(nuevoEstado)) {
    return fallo(
      `No se puede pasar de "${estadoActual}" a "${nuevoEstado}". Estados permitidos: ${
        TRANSICIONES[estadoActual].join(", ") || "ninguno"
      }.`,
    );
  }

  const cambios: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === "enviado") cambios.sent_at = new Date().toISOString();
  if (nuevoEstado === "aceptado") cambios.accepted_at = new Date().toISOString();

  const { error } = await supabase
    .from("presupuestos")
    .update(cambios)
    .eq("id", presupuestoId);

  if (error) return fallo("No se ha podido cambiar el estado del presupuesto.");

  revalidatePath(`/presupuestos/${presupuestoId}`);
  revalidatePath("/presupuestos");
  return { ok: true, datos: null };
}

// ---------------------------------------------------------------------------
// Duplicar
// ---------------------------------------------------------------------------

const CAMPOS_LINEA_COPIABLES = [
  "orden",
  "tipo_linea",
  "prenda_id",
  "tecnica_id",
  "descripcion",
  "cantidad",
  "color",
  "color_grupo",
  "ancho_logo_cm",
  "alto_logo_cm",
  "posicion",
  "puntadas",
  "num_colores",
  "prenda_oscura",
  "tipo_picaje_id",
  "coste_interno",
  "margen_aplicado_pct",
  "precio_unitario",
  "importe_linea",
  "detalle_calculo",
] as const;

/**
 * Copia cliente y líneas en un borrador nuevo.
 *
 * Las líneas se copian TAL CUAL, con su `detalle_calculo` original: CLAUDE.md
 * 7.6 dice explícitamente que al duplicar se usan los valores fijos del
 * snapshot y no se recalcula desde las tarifas actuales.
 */
export async function duplicarPresupuesto(
  presupuestoId: string,
): Promise<ResultadoAccion<{ presupuesto_id: string; numero: string }>> {
  const permiso = await sesionEditora();
  if (!permiso.ok) return permiso;

  const supabase = createClient();

  const { data: original } = await supabase
    .from("presupuestos")
    .select(
      "cliente_id, iva_pct, transporte, descuento_manual_pct, notas",
    )
    .eq("id", presupuestoId)
    .single();

  if (!original) return fallo("No se ha encontrado el presupuesto a duplicar.");

  const emision = hoyISO();
  const validez = sumarDiasISO(emision, DIAS_VALIDEZ_PRESUPUESTO);

  let nuevoId: string | null = null;
  let nuevoNumero = "";

  for (let intento = 0; intento < 5 && !nuevoId; intento += 1) {
    const numero = await siguienteNumero(supabase);
    const { data, error } = await supabase
      .from("presupuestos")
      .insert({
        numero,
        cliente_id: original.cliente_id,
        usuario_id: permiso.sesion.usuarioId,
        fecha_emision: emision,
        fecha_validez: validez,
        estado: "borrador",
        subtotal: 0,
        iva_pct: original.iva_pct,
        iva_importe: 0,
        total: 0,
        transporte: original.transporte,
        descuento_manual_pct: original.descuento_manual_pct,
        notas: original.notas,
      })
      .select("id, numero")
      .single();

    if (!error && data) {
      nuevoId = data.id as string;
      nuevoNumero = data.numero as string;
    } else if (error?.code !== "23505") {
      return fallo("No se ha podido duplicar el presupuesto.");
    }
  }

  if (!nuevoId) {
    return fallo("No se ha podido asignar un número al presupuesto duplicado.");
  }

  const { data: lineas } = await supabase
    .from("lineas_presupuesto")
    .select("*")
    .eq("presupuesto_id", presupuestoId)
    .order("orden");

  const filas = (lineas ?? []) as Record<string, unknown>[];

  // Primero las líneas ancla (las de técnica), para poder remapear el
  // `linea_padre_id` de sus hijas a los ids nuevos.
  const padres = filas.filter((fila) => fila.linea_padre_id === null);
  const hijas = filas.filter((fila) => fila.linea_padre_id !== null);

  function copiar(fila: Record<string, unknown>): Record<string, unknown> {
    const copia: Record<string, unknown> = { presupuesto_id: nuevoId };
    for (const campo of CAMPOS_LINEA_COPIABLES) copia[campo] = fila[campo];
    return copia;
  }

  const mapaIds = new Map<string, string>();

  if (padres.length) {
    const { data: insertadas, error } = await supabase
      .from("lineas_presupuesto")
      .insert(padres.map(copiar))
      .select("id, orden");

    if (error || !insertadas) {
      await supabase.from("presupuestos").delete().eq("id", nuevoId);
      return fallo("No se han podido copiar las líneas del presupuesto.");
    }

    // `orden` es único dentro del presupuesto, así que sirve de emparejador.
    const porOrden = new Map(
      insertadas.map((fila) => [Number(fila.orden), fila.id as string]),
    );
    for (const padre of padres) {
      const nuevo = porOrden.get(Number(padre.orden));
      if (nuevo) mapaIds.set(padre.id as string, nuevo);
    }
  }

  if (hijas.length) {
    const { error } = await supabase.from("lineas_presupuesto").insert(
      hijas.map((hija) => ({
        ...copiar(hija),
        linea_padre_id: mapaIds.get(hija.linea_padre_id as string) ?? null,
      })),
    );
    if (error) {
      await supabase.from("presupuestos").delete().eq("id", nuevoId);
      return fallo("No se han podido copiar las líneas del presupuesto.");
    }
  }

  await recalcularTotales(supabase, nuevoId);
  revalidatePath("/presupuestos");

  return {
    ok: true,
    datos: { presupuesto_id: nuevoId, numero: nuevoNumero },
  };
}
