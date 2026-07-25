"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuros } from "@/lib/format";
import type { Posicion } from "@/types/database";
import type { DetallesTecnica, ParametrosWizard } from "@/types/presupuestos";
import {
  Aviso,
  BotonesPaso,
  Campo,
  CasillaVerificacion,
  SelectorPosicion,
} from "./campos";

const esquema = z.object({
  posicion: z.enum(["pecho", "espalda", "manga", "gorra", "otro"]),
  ancho_logo_cm: z
    .number({ message: "Introduce el ancho en cm" })
    .positive("El ancho debe ser mayor que cero"),
  alto_logo_cm: z
    .number({ message: "Introduce el alto en cm" })
    .positive("El alto debe ser mayor que cero"),
  incluir_vectorizacion: z.boolean(),
});

type Valores = z.infer<typeof esquema>;

interface Props {
  valorInicial: Extract<DetallesTecnica, { tecnica: "DTF" }> | null;
  parametros: ParametrosWizard;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
}

export function FormularioDetallesDTF({
  valorInicial,
  parametros,
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
      ancho_logo_cm: valorInicial?.ancho_logo_cm ?? undefined,
      alto_logo_cm: valorInicial?.alto_logo_cm ?? undefined,
      incluir_vectorizacion: valorInicial?.incluir_vectorizacion ?? false,
    },
  });

  const posicion = watch("posicion");
  const vectorizacion = watch("incluir_vectorizacion");

  // El motor avisa cuando el logo no cabe en el rollo: el mensaje pertenece al
  // campo "Ancho del logo", no al pie del formulario.
  const errorAncho = errorMotor && /ancho|rollo/i.test(errorMotor) ? errorMotor : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((valores) =>
        onContinuar({
          tecnica: "DTF",
          posicion: valores.posicion,
          ancho_logo_cm: valores.ancho_logo_cm,
          alto_logo_cm: valores.alto_logo_cm,
          incluir_vectorizacion: valores.incluir_vectorizacion,
        }),
      )}
      className="space-y-6"
    >
      <Campo label="Ubicación del logo">
        <SelectorPosicion
          nombre="posicion"
          valor={posicion}
          onCambiar={(valor: Posicion) => setValue("posicion", valor)}
          disabled={calculando}
        />
      </Campo>

      <div className="grid max-w-md grid-cols-2 gap-4">
        <Campo
          htmlFor="ancho_logo_cm"
          label="Ancho del logo (cm)"
          error={errors.ancho_logo_cm?.message ?? errorAncho ?? undefined}
        >
          <Input
            id="ancho_logo_cm"
            type="number"
            step="0.1"
            min={0}
            inputMode="decimal"
            disabled={calculando}
            {...register("ancho_logo_cm", { valueAsNumber: true })}
          />
        </Campo>

        <Campo
          htmlFor="alto_logo_cm"
          label="Alto del logo (cm)"
          error={errors.alto_logo_cm?.message}
        >
          <Input
            id="alto_logo_cm"
            type="number"
            step="0.1"
            min={0}
            inputMode="decimal"
            disabled={calculando}
            {...register("alto_logo_cm", { valueAsNumber: true })}
          />
        </Campo>
      </div>

      <CasillaVerificacion
        id="incluir_vectorizacion"
        checked={vectorizacion}
        disabled={calculando}
        onChange={(valor) => setValue("incluir_vectorizacion", valor)}
      >
        Incluir vectorización del logo
        {vectorizacion && (
          <span className="ml-1 font-medium text-foreground">
            (+{formatEuros(parametros.vectorizacion)})
          </span>
        )}
      </CasillaVerificacion>

      {errorMotor && !errorAncho && <Aviso tono="danger">{errorMotor}</Aviso>}

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
