"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { crearPrenda, actualizarPrenda } from "@/app/(app)/admin/prendas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Prenda } from "@/types/database";

const prendaSchema = z.object({
  codigo_interno: z.string().min(1, "El código interno es obligatorio"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  modelo: z.string().optional(),
  proveedor_id: z.string().min(1, "Elige un proveedor"),
  tejido: z.enum(["algodon", "poliester", "mixto", "neopreno"]),
  disponible_oscuro: z.boolean(),
  descripcion: z.string().optional(),
});

type PrendaFormValues = z.infer<typeof prendaSchema>;

interface ProveedorOpcion {
  id: string;
  nombre: string;
}

interface PrendaFormProps {
  prenda?: Prenda;
  proveedores: ProveedorOpcion[];
}

function aTexto(valor: string | null | undefined) {
  return valor ?? "";
}

export function PrendaForm({ prenda, proveedores }: PrendaFormProps) {
  const router = useRouter();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const esEdicion = Boolean(prenda);
  const destinoCancelar = prenda ? `/admin/prendas/${prenda.id}` : "/admin/prendas";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PrendaFormValues>({
    resolver: zodResolver(prendaSchema),
    defaultValues: {
      codigo_interno: aTexto(prenda?.codigo_interno),
      nombre: aTexto(prenda?.nombre),
      modelo: aTexto(prenda?.modelo),
      proveedor_id: prenda?.proveedor_id ?? "",
      tejido: prenda?.tejido ?? "algodon",
      disponible_oscuro: prenda?.disponible_oscuro ?? true,
      descripcion: aTexto(prenda?.descripcion),
    },
  });

  async function onSubmit(valores: PrendaFormValues) {
    setErrorServidor(null);

    const datos = {
      codigo_interno: valores.codigo_interno,
      nombre: valores.nombre,
      modelo: valores.modelo || null,
      proveedor_id: valores.proveedor_id,
      tejido: valores.tejido,
      disponible_oscuro: valores.disponible_oscuro,
      descripcion: valores.descripcion || null,
    };

    const resultado = esEdicion
      ? await actualizarPrenda(prenda!.id, datos)
      : await crearPrenda(datos);

    if (resultado?.error) {
      setErrorServidor(resultado.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="max-w-2xl space-y-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="codigo_interno">Código interno</Label>
          <Input
            id="codigo_interno"
            disabled={isSubmitting}
            {...register("codigo_interno")}
          />
          {errors.codigo_interno && (
            <p className="text-sm text-danger">{errors.codigo_interno.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" disabled={isSubmitting} {...register("nombre")} />
          {errors.nombre && (
            <p className="text-sm text-danger">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="modelo">Modelo</Label>
          <Input
            id="modelo"
            placeholder="PTE modelo"
            disabled={isSubmitting}
            {...register("modelo")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="proveedor_id">Proveedor</Label>
          <Controller
            name="proveedor_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger id="proveedor_id">
                  <SelectValue placeholder="Elige un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((proveedor) => (
                    <SelectItem key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.proveedor_id && (
            <p className="text-sm text-danger">{errors.proveedor_id.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tejido">Tejido</Label>
          <Controller
            name="tejido"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger id="tejido">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="algodon">Algodón</SelectItem>
                  <SelectItem value="poliester">Poliéster</SelectItem>
                  <SelectItem value="mixto">Mixto</SelectItem>
                  <SelectItem value="neopreno">Neopreno</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          disabled={isSubmitting}
          {...register("disponible_oscuro")}
        />
        Disponible en color oscuro
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          rows={3}
          disabled={isSubmitting}
          {...register("descripcion")}
        />
      </div>

      {errorServidor && <p className="text-sm text-danger">{errorServidor}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar prenda"}
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
