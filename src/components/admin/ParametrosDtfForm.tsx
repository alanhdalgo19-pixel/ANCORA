"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { actualizarParametrosDTF } from "@/app/(app)/admin/tarifas/dtf/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParametrosDtf } from "@/types/database";

const parametrosSchema = z.object({
  ancho_rollo_cm: z.number().positive(),
  precio_metro: z.number().nonnegative(),
  recorte_por_logo: z.number().nonnegative(),
  mano_obra_por_minuto: z.number().nonnegative(),
  preparacion_pct: z.number().nonnegative(),
  minimo_trabajo: z.number().nonnegative(),
  margen_seguridad_cm: z.number().nonnegative(),
  minutos_setup_fijo: z.number().nonnegative(),
  minutos_por_logo: z.number().nonnegative(),
});

type ParametrosValues = z.infer<typeof parametrosSchema>;

interface ParametrosDtfFormProps {
  parametros: ParametrosDtf;
}

const CAMPOS: { nombre: keyof ParametrosValues; etiqueta: string; paso: string }[] = [
  { nombre: "ancho_rollo_cm", etiqueta: "Ancho de rollo (cm)", paso: "0.1" },
  { nombre: "precio_metro", etiqueta: "Precio por metro (€)", paso: "0.01" },
  { nombre: "recorte_por_logo", etiqueta: "Recorte por logo (€)", paso: "0.01" },
  { nombre: "mano_obra_por_minuto", etiqueta: "Mano de obra por minuto (€)", paso: "0.01" },
  { nombre: "preparacion_pct", etiqueta: "Preparación (%)", paso: "0.1" },
  { nombre: "minimo_trabajo", etiqueta: "Mínimo por trabajo (€)", paso: "0.01" },
  { nombre: "margen_seguridad_cm", etiqueta: "Margen de seguridad entre logos (cm)", paso: "0.1" },
  { nombre: "minutos_setup_fijo", etiqueta: "Minutos de setup fijo", paso: "0.1" },
  { nombre: "minutos_por_logo", etiqueta: "Minutos por logo", paso: "0.0001" },
];

// Preview local (pasos 1-9 de CLAUDE.md §7.2) — solo para que Espe vea si
// los parámetros dan resultados razonables. No es el motor de cálculo real
// (ese vive en src/lib/calculos/dtf.ts, pendiente del Prompt 7).
function calcularPreview(
  parametros: ParametrosValues,
  cantidad: number,
  anchoLogo: number,
  altoLogo: number,
) {
  if (!cantidad || !anchoLogo || !altoLogo) return null;

  const logosPorFila = Math.max(
    1,
    Math.floor(
      (parametros.ancho_rollo_cm - parametros.margen_seguridad_cm) /
        (anchoLogo + parametros.margen_seguridad_cm),
    ),
  );
  const filasNecesarias = Math.ceil(cantidad / logosPorFila);
  const metrosNecesarios =
    (filasNecesarias * (altoLogo + parametros.margen_seguridad_cm)) / 100;
  const material = metrosNecesarios * parametros.precio_metro;
  const recorte = cantidad * parametros.recorte_por_logo;
  const minutosEstimados =
    parametros.minutos_setup_fijo + parametros.minutos_por_logo * cantidad;
  const manoObra = minutosEstimados * parametros.mano_obra_por_minuto;
  const subtotalSinPreparacion = material + recorte + manoObra;
  const preparacion = subtotalSinPreparacion * (parametros.preparacion_pct / 100);
  let costeInterno = subtotalSinPreparacion + preparacion;
  const aplicadoMinimo = costeInterno < parametros.minimo_trabajo;
  if (aplicadoMinimo) costeInterno = parametros.minimo_trabajo;

  return {
    logosPorFila,
    filasNecesarias,
    metrosNecesarios,
    costeInterno,
    costePorLogo: costeInterno / cantidad,
    aplicadoMinimo,
  };
}

export function ParametrosDtfForm({ parametros }: ParametrosDtfFormProps) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ParametrosValues>({
    resolver: zodResolver(parametrosSchema),
    defaultValues: {
      ancho_rollo_cm: parametros.ancho_rollo_cm,
      precio_metro: parametros.precio_metro,
      recorte_por_logo: parametros.recorte_por_logo,
      mano_obra_por_minuto: parametros.mano_obra_por_minuto,
      preparacion_pct: parametros.preparacion_pct,
      minimo_trabajo: parametros.minimo_trabajo,
      margen_seguridad_cm: parametros.margen_seguridad_cm,
      minutos_setup_fijo: parametros.minutos_setup_fijo,
      minutos_por_logo: parametros.minutos_por_logo,
    },
  });

  const valoresActuales = watch();

  const [previewCantidad, setPreviewCantidad] = useState(120);
  const [previewAncho, setPreviewAncho] = useState(9);
  const [previewAlto, setPreviewAlto] = useState(4);

  const preview = useMemo(
    () => calcularPreview(valoresActuales, previewCantidad, previewAncho, previewAlto),
    [valoresActuales, previewCantidad, previewAncho, previewAlto],
  );

  async function onSubmit(valores: ParametrosValues) {
    setErrorServidor(null);
    setGuardado(false);
    const resultado = await actualizarParametrosDTF(valores);
    if (resultado.error) {
      setErrorServidor(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CAMPOS.map((campo) => (
            <div key={campo.nombre} className="space-y-1.5">
              <Label htmlFor={campo.nombre}>{campo.etiqueta}</Label>
              <Input
                id={campo.nombre}
                type="number"
                step={campo.paso}
                disabled={isSubmitting}
                {...register(campo.nombre, { valueAsNumber: true })}
              />
              {errors[campo.nombre] && (
                <p className="text-sm text-danger">Valor inválido</p>
              )}
            </div>
          ))}
        </div>

        {errorServidor && <p className="text-sm text-danger">{errorServidor}</p>}
        {guardado && !errorServidor && (
          <p className="text-sm text-success">Guardado ✓</p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>

      <aside className="h-fit space-y-4 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Preview de cálculo
        </h2>
        <p className="text-xs text-muted-foreground">
          Solo orientativo — no es el motor de cálculo final del wizard.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="preview_cantidad">Cantidad</Label>
          <Input
            id="preview_cantidad"
            type="number"
            min={1}
            value={previewCantidad}
            onChange={(evento) => setPreviewCantidad(Number(evento.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preview_ancho">Ancho del logo (cm)</Label>
          <Input
            id="preview_ancho"
            type="number"
            step="0.1"
            min={0.1}
            value={previewAncho}
            onChange={(evento) => setPreviewAncho(Number(evento.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preview_alto">Alto del logo (cm)</Label>
          <Input
            id="preview_alto"
            type="number"
            step="0.1"
            min={0.1}
            value={previewAlto}
            onChange={(evento) => setPreviewAlto(Number(evento.target.value))}
          />
        </div>

        {preview && (
          <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Logos por fila</dt>
              <dd className="font-medium text-foreground">{preview.logosPorFila}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Metros necesarios</dt>
              <dd className="font-medium text-foreground">
                {preview.metrosNecesarios.toFixed(2)} m
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Coste interno total</dt>
              <dd className="font-medium text-foreground">
                {preview.costeInterno.toFixed(2)} €
                {preview.aplicadoMinimo && " (mínimo aplicado)"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Coste aprox. por logo</dt>
              <dd className="font-medium text-foreground">
                {preview.costePorLogo.toFixed(2)} €
              </dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}
