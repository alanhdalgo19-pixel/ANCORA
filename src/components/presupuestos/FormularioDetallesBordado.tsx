"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuros } from "@/lib/format";
import type { CodigoPicaje, Posicion, UnidadMedidaBordado } from "@/types/database";
import type { DetallesTecnica, ParametrosWizard } from "@/types/presupuestos";
import {
  Aviso,
  BotonesPaso,
  Campo,
  CasillaVerificacion,
  SelectorPosicion,
} from "./campos";
import { cn } from "@/lib/utils";

const ETIQUETA_UNIDAD: Record<UnidadMedidaBordado, string> = {
  por_puntada: "por puntada",
  por_100_puntadas: "por 100 puntadas",
  por_1000_puntadas: "por 1.000 puntadas",
};

const esquema = z
  .object({
    posicion: z.enum(["pecho", "espalda", "manga", "gorra", "otro"]),
    ancho_logo_cm: z.number().positive().nullable().optional(),
    alto_logo_cm: z.number().positive().nullable().optional(),
    puntadas: z
      .number({ message: "Introduce el número de puntadas" })
      .int("Las puntadas son un número entero")
      .positive(
        "Sin puntadas no se puede calcular el bordado. Consúltalo con Espe antes de emitir.",
      ),
    tarifa: z.enum(["tarifa_1", "tarifa_2", "tarifa_3", "personalizada"]),
    precio_personalizado: z.number().positive().nullable().optional(),
    trabajo_nuevo: z.boolean(),
    tipo_picaje: z
      .enum(["SENCILLO", "MEDIO", "COMPLEJO", "PERSONALIZADO"])
      .nullable()
      .optional(),
    precio_picaje_personalizado: z.number().min(0).nullable().optional(),
  })
  .refine(
    (valores) =>
      valores.tarifa !== "personalizada" ||
      (valores.precio_personalizado ?? 0) > 0,
    {
      message: "Introduce el precio de la tarifa personalizada",
      path: ["precio_personalizado"],
    },
  )
  .refine((valores) => !valores.trabajo_nuevo || Boolean(valores.tipo_picaje), {
    message: "Elige el tipo de picaje del trabajo nuevo",
    path: ["tipo_picaje"],
  });

type Valores = z.infer<typeof esquema>;

interface Props {
  valorInicial: Extract<DetallesTecnica, { tecnica: "BORDADO" }> | null;
  parametros: ParametrosWizard;
  /** Descuento del cliente si es habitual; 0 en esporádicos. */
  descuentoBordadoPct: number;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
}

export function FormularioDetallesBordado({
  valorInicial,
  parametros,
  descuentoBordadoPct,
  errorMotor,
  calculando,
  onVolver,
  onContinuar,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      posicion: valorInicial?.posicion ?? "pecho",
      ancho_logo_cm: valorInicial?.ancho_logo_cm ?? null,
      alto_logo_cm: valorInicial?.alto_logo_cm ?? null,
      puntadas: valorInicial?.puntadas ?? undefined,
      tarifa: valorInicial?.tarifa ?? "tarifa_1",
      precio_personalizado:
        valorInicial?.precio_personalizado ??
        parametros.bordado.precio_personalizable_default,
      trabajo_nuevo: valorInicial?.trabajo_nuevo ?? true,
      tipo_picaje: valorInicial?.tipo_picaje ?? "SENCILLO",
      precio_picaje_personalizado:
        valorInicial?.precio_picaje_personalizado ?? null,
    },
  });

  const posicion = watch("posicion");
  const tarifa = watch("tarifa");
  const trabajoNuevo = watch("trabajo_nuevo");
  const tipoPicaje = watch("tipo_picaje");

  const unidad = ETIQUETA_UNIDAD[parametros.bordado.unidad_medida];

  const opcionesTarifa = [
    { valor: "tarifa_1" as const, precio: parametros.bordado.precio_tarifa_1 },
    { valor: "tarifa_2" as const, precio: parametros.bordado.precio_tarifa_2 },
    { valor: "tarifa_3" as const, precio: parametros.bordado.precio_tarifa_3 },
  ];

  const errorPuntadas =
    errors.puntadas?.message ??
    (errorMotor && /puntada/i.test(errorMotor) ? errorMotor : undefined);

  return (
    <form
      noValidate
      onSubmit={handleSubmit((valores) =>
        onContinuar({
          tecnica: "BORDADO",
          posicion: valores.posicion,
          ancho_logo_cm: valores.ancho_logo_cm ?? null,
          alto_logo_cm: valores.alto_logo_cm ?? null,
          puntadas: valores.puntadas,
          tarifa: valores.tarifa,
          precio_personalizado:
            valores.tarifa === "personalizada"
              ? (valores.precio_personalizado ?? null)
              : null,
          trabajo_nuevo: valores.trabajo_nuevo,
          tipo_picaje: valores.trabajo_nuevo
            ? (valores.tipo_picaje ?? null)
            : null,
          precio_picaje_personalizado:
            valores.trabajo_nuevo && valores.tipo_picaje === "PERSONALIZADO"
              ? (valores.precio_picaje_personalizado ?? null)
              : null,
        }),
      )}
      className="space-y-6"
    >
      <Campo label="Ubicación del bordado">
        <SelectorPosicion
          nombre="posicion"
          valor={posicion}
          onCambiar={(valor: Posicion) => setValue("posicion", valor)}
          disabled={calculando}
        />
      </Campo>

      <div className="grid max-w-md grid-cols-2 gap-4">
        <Campo htmlFor="ancho_logo_cm" label="Ancho del logo (cm)">
          <Input
            id="ancho_logo_cm"
            type="number"
            step="0.1"
            min={0}
            disabled={calculando}
            {...register("ancho_logo_cm", {
              setValueAs: (valor) => (valor === "" ? null : Number(valor)),
            })}
          />
        </Campo>
        <Campo htmlFor="alto_logo_cm" label="Alto del logo (cm)">
          <Input
            id="alto_logo_cm"
            type="number"
            step="0.1"
            min={0}
            disabled={calculando}
            {...register("alto_logo_cm", {
              setValueAs: (valor) => (valor === "" ? null : Number(valor)),
            })}
          />
        </Campo>
      </div>

      <Campo
        htmlFor="puntadas"
        label="Puntadas estimadas"
        error={errorPuntadas}
        className="max-w-xs"
        ayuda="Las medidas del logo son informativas: el precio del bordado sale de las puntadas. Si no las sabes, consúltalo con Espe antes de emitir."
      >
        <Input
          id="puntadas"
          type="number"
          step="100"
          min={1}
          inputMode="numeric"
          disabled={calculando}
          {...register("puntadas", { valueAsNumber: true })}
        />
      </Campo>

      <Campo label={`Tarifa (€ ${unidad})`} error={errors.tarifa?.message}>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {opcionesTarifa.map((opcion, indice) => (
            <button
              key={opcion.valor}
              type="button"
              role="radio"
              aria-checked={tarifa === opcion.valor}
              disabled={calculando}
              onClick={() => setValue("tarifa", opcion.valor)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                tarifa === opcion.valor
                  ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                  : "border-border text-muted-foreground hover:bg-accent/60",
              )}
            >
              Tarifa {indice + 1} · {opcion.precio.toFixed(2)} €
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={tarifa === "personalizada"}
            disabled={calculando}
            onClick={() => setValue("tarifa", "personalizada")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              tarifa === "personalizada"
                ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                : "border-border text-muted-foreground hover:bg-accent/60",
            )}
          >
            Personalizada
          </button>
        </div>
      </Campo>

      {tarifa === "personalizada" && (
        <Campo
          htmlFor="precio_personalizado"
          label={`Precio personalizado (€ ${unidad})`}
          error={errors.precio_personalizado?.message}
          className="max-w-xs"
        >
          <Input
            id="precio_personalizado"
            type="number"
            step="0.01"
            min={0}
            disabled={calculando}
            {...register("precio_personalizado", { valueAsNumber: true })}
          />
        </Campo>
      )}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <CasillaVerificacion
          id="trabajo_nuevo"
          checked={trabajoNuevo}
          disabled={calculando}
          onChange={(valor) => setValue("trabajo_nuevo", valor)}
        >
          Trabajo nuevo (se cobra picaje del logo)
        </CasillaVerificacion>

        {trabajoNuevo && (
          <Campo label="Tipo de picaje" error={errors.tipo_picaje?.message}>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {parametros.picajes.map((picaje) => (
                <button
                  key={picaje.codigo}
                  type="button"
                  role="radio"
                  aria-checked={tipoPicaje === picaje.codigo}
                  disabled={calculando}
                  onClick={() =>
                    setValue("tipo_picaje", picaje.codigo as CodigoPicaje)
                  }
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    tipoPicaje === picaje.codigo
                      ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                      : "border-border text-muted-foreground hover:bg-accent/60",
                  )}
                >
                  {picaje.nombre} · {formatEuros(picaje.precio_base)}
                </button>
              ))}
            </div>
          </Campo>
        )}

        {trabajoNuevo && tipoPicaje === "PERSONALIZADO" && (
          <Campo
            htmlFor="precio_picaje_personalizado"
            label="Precio del picaje personalizado (€)"
            className="max-w-xs"
          >
            <Input
              id="precio_picaje_personalizado"
              type="number"
              step="0.01"
              min={0}
              disabled={calculando}
              {...register("precio_picaje_personalizado", {
                setValueAs: (valor) => (valor === "" ? null : Number(valor)),
              })}
            />
          </Campo>
        )}
      </div>

      {descuentoBordadoPct > 0 && (
        <Aviso tono="info">
          Cliente habitual: se aplicará un descuento del {descuentoBordadoPct}%
          sobre el precio por puntadas.
        </Aviso>
      )}

      {errorMotor && !errorPuntadas && <Aviso tono="danger">{errorMotor}</Aviso>}

      <BotonesPaso>
        <Button type="submit" disabled={calculando}>
          {calculando ? "Calculando…" : "Ver cálculo"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onVolver}
          disabled={calculando}
        >
          Volver
        </Button>
      </BotonesPaso>
    </form>
  );
}
