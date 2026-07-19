"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { actualizarParametrosImpresionDirecta } from "@/app/(app)/admin/tarifas/impresion-directa/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParametrosImpresionDirecta } from "@/types/database";

const parametrosSchema = z.object({
  solo_algodon: z.boolean(),
  minimo_trabajo: z.number().nonnegative(),
});

type ParametrosValues = z.infer<typeof parametrosSchema>;

interface ParametrosImpresionDirectaFormProps {
  parametros: ParametrosImpresionDirecta;
}

export function ParametrosImpresionDirectaForm({
  parametros,
}: ParametrosImpresionDirectaFormProps) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ParametrosValues>({
    resolver: zodResolver(parametrosSchema),
    defaultValues: {
      solo_algodon: parametros.solo_algodon,
      minimo_trabajo: parametros.minimo_trabajo,
    },
  });

  async function onSubmit(valores: ParametrosValues) {
    setErrorServidor(null);
    setGuardado(false);
    const resultado = await actualizarParametrosImpresionDirecta(valores);
    if (resultado.error) {
      setErrorServidor(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-6">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          disabled={isSubmitting}
          {...register("solo_algodon")}
        />
        Solo disponible sobre algodón
      </label>

      <div className="max-w-[10rem] space-y-1.5">
        <Label htmlFor="minimo_trabajo">Mínimo por trabajo (€)</Label>
        <Input
          id="minimo_trabajo"
          type="number"
          step="0.01"
          disabled={isSubmitting}
          {...register("minimo_trabajo", { valueAsNumber: true })}
        />
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
