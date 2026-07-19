"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { actualizarParametrosBordado } from "@/app/(app)/admin/tarifas/bordado/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ParametrosBordado } from "@/types/database";

const parametrosSchema = z.object({
  precio_tarifa_1: z.number().nonnegative(),
  precio_tarifa_2: z.number().nonnegative(),
  precio_tarifa_3: z.number().nonnegative(),
  precio_personalizable_default: z.number().nonnegative(),
  unidad_medida: z.enum(["por_puntada", "por_100_puntadas", "por_1000_puntadas"]),
  minimo_pieza: z.number().nonnegative(),
  minimo_trabajo: z.number().nonnegative(),
});

type ParametrosValues = z.infer<typeof parametrosSchema>;

const OPCIONES_UNIDAD: { valor: ParametrosValues["unidad_medida"]; etiqueta: string }[] = [
  { valor: "por_puntada", etiqueta: "Por puntada" },
  { valor: "por_100_puntadas", etiqueta: "Por cada 100 puntadas" },
  { valor: "por_1000_puntadas", etiqueta: "Por cada 1000 puntadas" },
];

interface ParametrosBordadoFormProps {
  parametros: ParametrosBordado;
}

export function ParametrosBordadoForm({ parametros }: ParametrosBordadoFormProps) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ParametrosValues>({
    resolver: zodResolver(parametrosSchema),
    defaultValues: {
      precio_tarifa_1: parametros.precio_tarifa_1,
      precio_tarifa_2: parametros.precio_tarifa_2,
      precio_tarifa_3: parametros.precio_tarifa_3,
      precio_personalizable_default: parametros.precio_personalizable_default,
      unidad_medida: parametros.unidad_medida,
      minimo_pieza: parametros.minimo_pieza,
      minimo_trabajo: parametros.minimo_trabajo,
    },
  });

  async function onSubmit(valores: ParametrosValues) {
    setErrorServidor(null);
    setGuardado(false);
    const resultado = await actualizarParametrosBordado(valores);
    if (resultado.error) {
      setErrorServidor(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="max-w-2xl space-y-6"
    >
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
        ⚠️ La unidad de medida está en <strong>por_1000_puntadas</strong> por
        sospecha razonada a partir de presupuestos históricos. Confirmar con
        Espe en el primer uso real (CLAUDE.md sección 10, punto 15).
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="precio_tarifa_1">Tarifa 1 (€)</Label>
          <Input
            id="precio_tarifa_1"
            type="number"
            step="0.0001"
            disabled={isSubmitting}
            {...register("precio_tarifa_1", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="precio_tarifa_2">Tarifa 2 (€)</Label>
          <Input
            id="precio_tarifa_2"
            type="number"
            step="0.0001"
            disabled={isSubmitting}
            {...register("precio_tarifa_2", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="precio_tarifa_3">Tarifa 3 (€)</Label>
          <Input
            id="precio_tarifa_3"
            type="number"
            step="0.0001"
            disabled={isSubmitting}
            {...register("precio_tarifa_3", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="precio_personalizable_default">
            Personalizable (por defecto, €)
          </Label>
          <Input
            id="precio_personalizable_default"
            type="number"
            step="0.0001"
            disabled={isSubmitting}
            {...register("precio_personalizable_default", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="unidad_medida">Unidad de medida</Label>
        <Controller
          name="unidad_medida"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
              <SelectTrigger id="unidad_medida">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_UNIDAD.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="minimo_pieza">Mínimo por pieza (€)</Label>
          <Input
            id="minimo_pieza"
            type="number"
            step="0.01"
            disabled={isSubmitting}
            {...register("minimo_pieza", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minimo_trabajo">Mínimo por trabajo (€)</Label>
          <Input
            id="minimo_trabajo"
            type="number"
            step="0.01"
            disabled={isSubmitting}
            {...register("minimo_trabajo", { valueAsNumber: true })}
          />
        </div>
      </div>

      {errorServidor && <p className="text-sm text-danger">{errorServidor}</p>}
      {guardado && !errorServidor && (
        <p className="text-sm text-success">Guardado ✓</p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
