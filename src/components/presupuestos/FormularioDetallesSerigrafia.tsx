"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DetallesTecnica, ParametrosWizard } from "@/types/presupuestos";
import {
  Aviso,
  BotonesPaso,
  Campo,
  CasillaVerificacion,
  SelectorPosicion,
} from "./campos";

const esquema = z.object({
  ubicacion: z.enum(["pecho", "espalda"]),
  num_colores: z.union([z.literal(1), z.literal(2)]),
  prenda_oscura: z.boolean(),
  trabajo_nuevo: z.boolean(),
  incluir_vectorizacion: z.boolean(),
  incluir_pantone: z.boolean(),
  cantidad_pantones: z.number().int().min(1).nullable().optional(),
});

type Valores = z.infer<typeof esquema>;

interface Props {
  valorInicial: Extract<DetallesTecnica, { tecnica: "SERIGRAFIA" }> | null;
  parametros: ParametrosWizard;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
}

export function FormularioDetallesSerigrafia({
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
      ubicacion: valorInicial?.ubicacion ?? "pecho",
      num_colores: valorInicial?.num_colores ?? 1,
      prenda_oscura: valorInicial?.prenda_oscura ?? false,
      trabajo_nuevo: valorInicial?.trabajo_nuevo ?? true,
      incluir_vectorizacion: valorInicial?.incluir_vectorizacion ?? false,
      incluir_pantone: valorInicial?.incluir_pantone ?? false,
      cantidad_pantones: valorInicial?.cantidad_pantones ?? null,
    },
  });

  const ubicacion = watch("ubicacion");
  const numColores = watch("num_colores");
  const prendaOscura = watch("prenda_oscura");
  const trabajoNuevo = watch("trabajo_nuevo");
  const vectorizacion = watch("incluir_vectorizacion");
  const pantone = watch("incluir_pantone");

  const fotolito =
    ubicacion === "pecho"
      ? parametros.fotolito_pecho
      : parametros.fotolito_espalda;

  const errorColores =
    errorMotor && /color/i.test(errorMotor) ? errorMotor : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((valores) =>
        onContinuar({
          tecnica: "SERIGRAFIA",
          ubicacion: valores.ubicacion,
          num_colores: valores.num_colores,
          prenda_oscura: valores.prenda_oscura,
          trabajo_nuevo: valores.trabajo_nuevo,
          incluir_vectorizacion: valores.incluir_vectorizacion,
          incluir_pantone: valores.incluir_pantone,
          cantidad_pantones: valores.incluir_pantone
            ? (valores.cantidad_pantones ?? null)
            : null,
        }),
      )}
      className="space-y-6"
    >
      <Campo
        label="Ubicación"
        ayuda="La tarifa de serigrafía solo cubre pecho y espalda."
      >
        <SelectorPosicion
          nombre="ubicacion"
          valor={ubicacion}
          soloPechoEspalda
          disabled={calculando}
          onCambiar={(valor) => {
            if (valor === "pecho" || valor === "espalda") {
              setValue("ubicacion", valor);
            }
          }}
        />
      </Campo>

      <Campo label="Número de colores" error={errorColores ?? undefined}>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {[1, 2].map((colores) => (
            <button
              key={colores}
              type="button"
              role="radio"
              aria-checked={numColores === colores}
              disabled={calculando}
              onClick={() => setValue("num_colores", colores === 2 ? 2 : 1)}
              className={cn(
                "rounded-md border px-4 py-1.5 text-sm transition-colors",
                numColores === colores
                  ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                  : "border-border text-muted-foreground hover:bg-accent/60",
              )}
            >
              {colores} {colores === 1 ? "color" : "colores"}
            </button>
          ))}
          <button
            type="button"
            disabled
            title="Máximo 2 colores actualmente"
            className="cursor-not-allowed rounded-md border border-border px-4 py-1.5 text-sm text-muted-foreground opacity-40"
          >
            3 o más
          </button>
        </div>
      </Campo>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <CasillaVerificacion
          id="prenda_oscura"
          checked={prendaOscura}
          disabled={calculando}
          onChange={(valor) => setValue("prenda_oscura", valor)}
        >
          Prenda oscura (lleva base blanca)
        </CasillaVerificacion>

        <CasillaVerificacion
          id="trabajo_nuevo"
          checked={trabajoNuevo}
          disabled={calculando}
          onChange={(valor) => setValue("trabajo_nuevo", valor)}
        >
          Trabajo nuevo — se cobran fotolitos
          {trabajoNuevo && (
            <span className="ml-1 font-medium text-foreground">
              ({formatEuros(fotolito)} × {numColores} ={" "}
              {formatEuros(fotolito * numColores)})
            </span>
          )}
        </CasillaVerificacion>

        <CasillaVerificacion
          id="incluir_vectorizacion"
          checked={vectorizacion}
          disabled={calculando}
          onChange={(valor) => setValue("incluir_vectorizacion", valor)}
        >
          Incluir vectorización
          {vectorizacion && (
            <span className="ml-1 font-medium text-foreground">
              (+{formatEuros(parametros.vectorizacion)})
            </span>
          )}
        </CasillaVerificacion>

        <CasillaVerificacion
          id="incluir_pantone"
          checked={pantone}
          disabled={calculando}
          onChange={(valor) => setValue("incluir_pantone", valor)}
        >
          Incluir tintas pantone ({formatEuros(parametros.pantone_por_color)} por
          tinta)
        </CasillaVerificacion>

        {pantone && (
          <Campo
            htmlFor="cantidad_pantones"
            label="Número de pantones"
            className="max-w-[12rem]"
            ayuda="Si lo dejas vacío se cobra uno por color."
            error={errors.cantidad_pantones?.message}
          >
            <Input
              id="cantidad_pantones"
              type="number"
              min={1}
              step={1}
              disabled={calculando}
              {...register("cantidad_pantones", {
                setValueAs: (valor) => (valor === "" ? null : Number(valor)),
              })}
            />
          </Campo>
        )}
      </div>

      {errorMotor && !errorColores && <Aviso tono="danger">{errorMotor}</Aviso>}

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
