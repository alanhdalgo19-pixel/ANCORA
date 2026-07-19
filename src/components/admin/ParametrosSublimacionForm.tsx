"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { actualizarParametrosSublimacion } from "@/app/(app)/admin/tarifas/sublimacion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParametrosSublimacion } from "@/types/database";

const parametrosSchema = z.object({
  precio_unitario_base: z.number().nonnegative(),
  cantidad_minima: z.number().int().nonnegative(),
  tasa_merma_pct: z.number().nonnegative(),
  solo_blanco_poliester: z.boolean(),
});

type ParametrosValues = z.infer<typeof parametrosSchema>;

interface ParametrosSublimacionFormProps {
  parametros: ParametrosSublimacion;
}

export function ParametrosSublimacionForm({
  parametros,
}: ParametrosSublimacionFormProps) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ParametrosValues>({
    resolver: zodResolver(parametrosSchema),
    defaultValues: {
      precio_unitario_base: parametros.precio_unitario_base ?? 0,
      cantidad_minima: parametros.cantidad_minima ?? 0,
      tasa_merma_pct: parametros.tasa_merma_pct ?? 0,
      solo_blanco_poliester: parametros.solo_blanco_poliester,
    },
  });

  async function onSubmit(valores: ParametrosValues) {
    setErrorServidor(null);
    setGuardado(false);
    const resultado = await actualizarParametrosSublimacion(valores);
    if (resultado.error) {
      setErrorServidor(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="precio_unitario_base">Precio unitario base (€)</Label>
        <Input
          id="precio_unitario_base"
          type="number"
          step="0.01"
          disabled={isSubmitting}
          {...register("precio_unitario_base", { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cantidad_minima">Cantidad mínima</Label>
        <Input
          id="cantidad_minima"
          type="number"
          step="1"
          disabled={isSubmitting}
          {...register("cantidad_minima", { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tasa_merma_pct">Tasa de merma (%)</Label>
        <Input
          id="tasa_merma_pct"
          type="number"
          step="0.1"
          disabled={isSubmitting}
          {...register("tasa_merma_pct", { valueAsNumber: true })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          disabled={isSubmitting}
          {...register("solo_blanco_poliester")}
        />
        Solo disponible en blanco/poliéster
      </label>

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
