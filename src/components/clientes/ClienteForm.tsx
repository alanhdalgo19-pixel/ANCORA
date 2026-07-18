"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { crearCliente, actualizarCliente } from "@/app/(app)/clientes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Cliente } from "@/types/database";

const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  cif: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine(
      (valor) => !valor || z.string().email().safeParse(valor).success,
      "Introduce un email válido",
    ),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  codigo_postal: z.string().optional(),
  localidad: z.string().optional(),
  provincia: z.string().optional(),
  persona_contacto: z.string().optional(),
  condiciones_pago: z.string().optional(),
  tipo_cliente: z.enum(["esporadico", "habitual"]),
  descuento_bordado_pct: z
    .number()
    .min(0, "El descuento no puede ser negativo")
    .max(50, "El descuento máximo es 50%")
    .optional(),
});

type ClienteFormValues = z.infer<typeof clienteSchema>;

interface ClienteFormProps {
  cliente?: Cliente;
}

function aTexto(valor: string | null | undefined) {
  return valor ?? "";
}

export function ClienteForm({ cliente }: ClienteFormProps) {
  const router = useRouter();
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const esEdicion = Boolean(cliente);
  const destinoCancelar = cliente ? `/clientes/${cliente.id}` : "/clientes";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: aTexto(cliente?.nombre),
      cif: aTexto(cliente?.cif),
      email: aTexto(cliente?.email),
      telefono: aTexto(cliente?.telefono),
      direccion: aTexto(cliente?.direccion),
      codigo_postal: aTexto(cliente?.codigo_postal),
      localidad: aTexto(cliente?.localidad),
      provincia: cliente?.provincia ?? "Illes Balears",
      persona_contacto: aTexto(cliente?.persona_contacto),
      condiciones_pago: aTexto(cliente?.condiciones_pago),
      tipo_cliente: cliente?.tipo_cliente ?? "esporadico",
      descuento_bordado_pct: cliente?.descuento_bordado_pct ?? 0,
    },
  });

  const tipoCliente = watch("tipo_cliente");

  async function onSubmit(valores: ClienteFormValues) {
    setErrorServidor(null);

    const datos = {
      nombre: valores.nombre,
      cif: valores.cif || null,
      email: valores.email || null,
      telefono: valores.telefono || null,
      direccion: valores.direccion || null,
      codigo_postal: valores.codigo_postal || null,
      localidad: valores.localidad || null,
      provincia: valores.provincia || null,
      persona_contacto: valores.persona_contacto || null,
      condiciones_pago: valores.condiciones_pago || null,
      tipo_cliente: valores.tipo_cliente,
      descuento_bordado_pct:
        valores.tipo_cliente === "habitual"
          ? (valores.descuento_bordado_pct ?? 0)
          : 0,
    };

    const resultado = esEdicion
      ? await actualizarCliente(cliente!.id, datos)
      : await crearCliente(datos);

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
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" disabled={isSubmitting} {...register("nombre")} />
          {errors.nombre && (
            <p className="text-sm text-danger">{errors.nombre.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cif">CIF</Label>
          <Input
            id="cif"
            placeholder="Vacío para cliente CONTADO"
            disabled={isSubmitting}
            {...register("cif")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            disabled={isSubmitting}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-danger">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" disabled={isSubmitting} {...register("telefono")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="persona_contacto">Persona de contacto</Label>
          <Input
            id="persona_contacto"
            disabled={isSubmitting}
            {...register("persona_contacto")}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="direccion">Dirección</Label>
          <Input id="direccion" disabled={isSubmitting} {...register("direccion")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="codigo_postal">Código postal</Label>
          <Input
            id="codigo_postal"
            disabled={isSubmitting}
            {...register("codigo_postal")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="localidad">Localidad</Label>
          <Input id="localidad" disabled={isSubmitting} {...register("localidad")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provincia">Provincia</Label>
          <Input id="provincia" disabled={isSubmitting} {...register("provincia")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="condiciones_pago">Condiciones de pago</Label>
        <Textarea
          id="condiciones_pago"
          rows={3}
          disabled={isSubmitting}
          {...register("condiciones_pago")}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de cliente</Label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="esporadico"
              disabled={isSubmitting}
              {...register("tipo_cliente")}
            />
            Esporádico / menor
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="habitual"
              disabled={isSubmitting}
              {...register("tipo_cliente")}
            />
            Habitual / mayor
          </label>
        </div>
      </div>

      {tipoCliente === "habitual" && (
        <div className="max-w-[10rem] space-y-1.5">
          <Label htmlFor="descuento_bordado_pct">Descuento bordado (%)</Label>
          <Input
            id="descuento_bordado_pct"
            type="number"
            step="0.01"
            min={0}
            max={50}
            disabled={isSubmitting}
            {...register("descuento_bordado_pct", { valueAsNumber: true })}
          />
          {errors.descuento_bordado_pct && (
            <p className="text-sm text-danger">
              {errors.descuento_bordado_pct.message}
            </p>
          )}
        </div>
      )}

      {errorServidor && <p className="text-sm text-danger">{errorServidor}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar cliente"}
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
