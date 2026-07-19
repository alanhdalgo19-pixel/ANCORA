"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { actualizarParametrosSerigrafia } from "@/app/(app)/admin/tarifas/serigrafia/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParametrosSerigrafia } from "@/types/database";

const parametrosSchema = z.object({
  recargo_oscura_pecho_por_color: z.number().nonnegative(),
  recargo_oscura_espalda_por_color: z.number().nonnegative(),
  fotolito_pecho: z.number().nonnegative(),
  fotolito_espalda: z.number().nonnegative(),
  minimo_trabajo: z.number().nonnegative(),
  pantone_por_color: z.number().nonnegative(),
  vectorizacion: z.number().nonnegative(),
});

type ParametrosValues = z.infer<typeof parametrosSchema>;

const CAMPOS: { nombre: keyof ParametrosValues; etiqueta: string }[] = [
  { nombre: "recargo_oscura_pecho_por_color", etiqueta: "Recargo prenda oscura, pecho (€/color)" },
  { nombre: "recargo_oscura_espalda_por_color", etiqueta: "Recargo prenda oscura, espalda (€/color)" },
  { nombre: "fotolito_pecho", etiqueta: "Fotolito pecho (€/color)" },
  { nombre: "fotolito_espalda", etiqueta: "Fotolito espalda (€/color)" },
  { nombre: "pantone_por_color", etiqueta: "Pantone (€/color)" },
  { nombre: "vectorizacion", etiqueta: "Vectorización (€/logo)" },
  { nombre: "minimo_trabajo", etiqueta: "Mínimo por trabajo (€)" },
];

interface ParametrosSerigrafiaFormProps {
  parametros: ParametrosSerigrafia;
}

export function ParametrosSerigrafiaForm({ parametros }: ParametrosSerigrafiaFormProps) {
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ParametrosValues>({
    resolver: zodResolver(parametrosSchema),
    defaultValues: {
      recargo_oscura_pecho_por_color: parametros.recargo_oscura_pecho_por_color,
      recargo_oscura_espalda_por_color: parametros.recargo_oscura_espalda_por_color,
      fotolito_pecho: parametros.fotolito_pecho,
      fotolito_espalda: parametros.fotolito_espalda,
      minimo_trabajo: parametros.minimo_trabajo,
      pantone_por_color: parametros.pantone_por_color,
      vectorizacion: parametros.vectorizacion,
    },
  });

  async function onSubmit(valores: ParametrosValues) {
    setErrorServidor(null);
    setGuardado(false);
    const resultado = await actualizarParametrosSerigrafia(valores);
    if (resultado.error) {
      setErrorServidor(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAMPOS.map((campo) => (
          <div key={campo.nombre} className="space-y-1.5">
            <Label htmlFor={campo.nombre}>{campo.etiqueta}</Label>
            <Input
              id={campo.nombre}
              type="number"
              step="0.01"
              disabled={isSubmitting}
              {...register(campo.nombre, { valueAsNumber: true })}
            />
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
  );
}
