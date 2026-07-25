"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  incluir_vectorizacion: z.boolean(),
});

type Valores = z.infer<typeof esquema>;

interface Props {
  valorInicial: Extract<
    DetallesTecnica,
    { tecnica: "IMPRESION_DIRECTA" }
  > | null;
  parametros: ParametrosWizard;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
}

export function FormularioDetallesImpresionDirecta({
  valorInicial,
  parametros,
  errorMotor,
  calculando,
  onVolver,
  onContinuar,
}: Props) {
  const { handleSubmit, watch, setValue } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      ubicacion: valorInicial?.ubicacion ?? "pecho",
      num_colores: valorInicial?.num_colores ?? 1,
      prenda_oscura: valorInicial?.prenda_oscura ?? false,
      incluir_vectorizacion: valorInicial?.incluir_vectorizacion ?? false,
    },
  });

  const ubicacion = watch("ubicacion");
  const numColores = watch("num_colores");
  const prendaOscura = watch("prenda_oscura");
  const vectorizacion = watch("incluir_vectorizacion");

  const errorColores =
    errorMotor && /color/i.test(errorMotor) ? errorMotor : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((valores) =>
        onContinuar({
          tecnica: "IMPRESION_DIRECTA",
          ubicacion: valores.ubicacion,
          num_colores: valores.num_colores,
          prenda_oscura: valores.prenda_oscura,
          incluir_vectorizacion: valores.incluir_vectorizacion,
        }),
      )}
      className="space-y-6"
    >
      <Campo
        label="Ubicación"
        ayuda="Comparte tarifa con serigrafía: solo pecho y espalda."
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
          id="prenda_oscura_id"
          checked={prendaOscura}
          disabled={calculando}
          onChange={(valor) => setValue("prenda_oscura", valor)}
        >
          Prenda oscura
        </CasillaVerificacion>

        <CasillaVerificacion
          id="incluir_vectorizacion_id"
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

        <p className="text-xs text-muted-foreground">
          La impresión directa no lleva fotolitos ni pantones.
        </p>
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
