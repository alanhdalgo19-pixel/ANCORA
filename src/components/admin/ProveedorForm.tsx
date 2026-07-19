"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  crearProveedor,
  actualizarProveedor,
} from "@/app/(app)/admin/proveedores/actions";
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
import type { Proveedor } from "@/types/database";

const SIN_TIPO = "sin_tipo";

const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  tipo: z.enum(["urgencia", "precio", "calidad", SIN_TIPO]),
  dias_entrega: z.number().int().nonnegative().optional(),
});

type ProveedorFormValues = z.infer<typeof proveedorSchema>;

interface ProveedorFormProps {
  proveedor?: Proveedor;
}

export function ProveedorForm({ proveedor }: ProveedorFormProps) {
  const router = useRouter();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const esEdicion = Boolean(proveedor);
  const destinoCancelar = proveedor
    ? `/admin/proveedores/${proveedor.id}`
    : "/admin/proveedores";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProveedorFormValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: {
      nombre: proveedor?.nombre ?? "",
      tipo: proveedor?.tipo ?? SIN_TIPO,
      dias_entrega: proveedor?.dias_entrega ?? undefined,
    },
  });

  async function onSubmit(valores: ProveedorFormValues) {
    setErrorServidor(null);

    const datos = {
      nombre: valores.nombre,
      tipo: valores.tipo === SIN_TIPO ? null : valores.tipo,
      dias_entrega: valores.dias_entrega ?? null,
    };

    const resultado = esEdicion
      ? await actualizarProveedor(proveedor!.id, datos)
      : await crearProveedor(datos);

    if (resultado?.error) {
      setErrorServidor(resultado.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="max-w-md space-y-6"
    >
      <div className="space-y-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" disabled={isSubmitting} {...register("nombre")} />
        {errors.nombre && (
          <p className="text-sm text-danger">{errors.nombre.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <Controller
          name="tipo"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_TIPO}>Sin clasificar</SelectItem>
                <SelectItem value="urgencia">Urgencia</SelectItem>
                <SelectItem value="precio">Precio</SelectItem>
                <SelectItem value="calidad">Calidad</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="max-w-[10rem] space-y-1.5">
        <Label htmlFor="dias_entrega">Días de entrega</Label>
        <Input
          id="dias_entrega"
          type="number"
          step="1"
          min={0}
          disabled={isSubmitting}
          {...register("dias_entrega", { valueAsNumber: true })}
        />
      </div>

      {errorServidor && <p className="text-sm text-danger">{errorServidor}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar proveedor"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => router.push(destinoCancelar)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
