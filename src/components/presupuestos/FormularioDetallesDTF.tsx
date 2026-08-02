"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { previsualizarComposicionDTF } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuros, formatMedida } from "@/lib/format";
import { NOMBRE_POSICION } from "@/lib/presupuestos/descripciones";
import type { Posicion } from "@/types/database";
import {
  MAX_LOGOS_COMPOSICION,
  type DetallesTecnica,
  type LogoDTFWizard,
  type ParametrosWizard,
  type PreviewComposicionDTF,
} from "@/types/presupuestos";
import {
  Aviso,
  BotonesPaso,
  Campo,
  CasillaVerificacion,
  SelectorPosicion,
} from "./campos";

/** Milisegundos de espera antes de recalcular mientras Sonia teclea. */
const DEBOUNCE_MS = 300;

const esquemaLogo = z.object({
  posicion: z.enum(["pecho", "espalda", "manga", "gorra", "otro"]),
  ancho_cm: z
    .number({ message: "Introduce el ancho en cm" })
    .positive("El ancho debe ser mayor que cero"),
  alto_cm: z
    .number({ message: "Introduce el alto en cm" })
    .positive("El alto debe ser mayor que cero"),
  rotable: z.boolean(),
});

interface Props {
  valorInicial: Extract<DetallesTecnica, { tecnica: "DTF" }> | null;
  parametros: ParametrosWizard;
  presupuestoId: string;
  cantidad: number;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
}

const LOGO_VACIO: LogoDTFWizard = {
  posicion: "pecho",
  ancho_cm: Number.NaN,
  alto_cm: Number.NaN,
  rotable: false,
};

export function FormularioDetallesDTF({
  valorInicial,
  parametros,
  presupuestoId,
  cantidad,
  errorMotor,
  calculando,
  onVolver,
  onContinuar,
}: Props) {
  // Un logo que no cabe a lo ancho del rollo obliga a rotarlo o a reducirlo:
  // el bin packing no puede partirlo (CLAUDE.md 7.2 y Prompt 8, parte E.1).
  const anchoUtil =
    parametros.dtf.ancho_rollo_cm - 2 * parametros.dtf.margen_seguridad_cm;

  const esquema = z.object({
    logos: z
      .array(esquemaLogo)
      .min(1, "Añade al menos un logo")
      .max(
        MAX_LOGOS_COMPOSICION,
        `Como máximo ${MAX_LOGOS_COMPOSICION} logos por línea`,
      )
      .superRefine((logos, ctx) => {
        logos.forEach((logo, indice) => {
          if (logo.rotable || logo.ancho_cm <= anchoUtil) return;
          ctx.addIssue({
            code: "custom",
            path: [indice, "ancho_cm"],
            message: `El logo '${NOMBRE_POSICION[logo.posicion].toLowerCase()}' es demasiado ancho. Marca “Rotable” o reduce el tamaño.`,
          });
        });
      }),
    incluir_vectorizacion: z.boolean(),
  });

  type Valores = z.infer<typeof esquema>;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      logos: valorInicial?.logos.length
        ? valorInicial.logos.map((logo) => ({ ...logo }))
        : [{ ...LOGO_VACIO }],
      incluir_vectorizacion: valorInicial?.incluir_vectorizacion ?? false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "logos" });
  const logos = watch("logos");
  const vectorizacion = watch("incluir_vectorizacion");

  const { preview, errorPreview, calculandoPreview } = usePreviewComposicion(
    presupuestoId,
    cantidad,
    logos,
  );

  const erroresLogos = errors.logos;
  // Zod devuelve el error de `.max()` en la raíz del array, no en un elemento.
  const errorLista =
    (Array.isArray(erroresLogos) ? undefined : erroresLogos?.message) ??
    undefined;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((valores) =>
        onContinuar({
          tecnica: "DTF",
          logos: valores.logos,
          incluir_vectorizacion: valores.incluir_vectorizacion,
        }),
      )}
      className="space-y-6"
    >
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-foreground">
          Logos del diseño
        </legend>
        <p className="text-xs text-muted-foreground">
          Todos los logos se estampan sobre cada una de las {cantidad} unidades.
          Con más de uno, el sistema los encaja en el mismo rollo para gastar
          menos metros.
        </p>

        {fields.map((field, indice) => {
          const errorLogo = Array.isArray(erroresLogos)
            ? erroresLogos[indice]
            : undefined;

          return (
            <div
              key={field.id}
              className="space-y-4 rounded-md border border-border bg-muted/40 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Logo {indice + 1}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  disabled={calculando || fields.length === 1}
                  title={
                    fields.length === 1
                      ? "La línea necesita al menos un logo"
                      : undefined
                  }
                  onClick={() => remove(indice)}
                >
                  Quitar
                </Button>
              </div>

              <Campo label="Ubicación del logo">
                <SelectorPosicion
                  nombre={`logos.${indice}.posicion`}
                  valor={logos[indice]?.posicion ?? "pecho"}
                  onCambiar={(valor: Posicion) =>
                    setValue(`logos.${indice}.posicion`, valor, {
                      shouldValidate: true,
                    })
                  }
                  disabled={calculando}
                />
              </Campo>

              <div className="grid max-w-md grid-cols-2 gap-4">
                <Campo
                  htmlFor={`logo-${indice}-ancho`}
                  label="Ancho del logo (cm)"
                  error={errorLogo?.ancho_cm?.message}
                >
                  <Input
                    id={`logo-${indice}-ancho`}
                    type="number"
                    step="0.1"
                    min={0}
                    inputMode="decimal"
                    disabled={calculando}
                    {...register(`logos.${indice}.ancho_cm`, {
                      valueAsNumber: true,
                    })}
                  />
                </Campo>

                <Campo
                  htmlFor={`logo-${indice}-alto`}
                  label="Alto del logo (cm)"
                  error={errorLogo?.alto_cm?.message}
                >
                  <Input
                    id={`logo-${indice}-alto`}
                    type="number"
                    step="0.1"
                    min={0}
                    inputMode="decimal"
                    disabled={calculando}
                    {...register(`logos.${indice}.alto_cm`, {
                      valueAsNumber: true,
                    })}
                  />
                </Campo>
              </div>

              <CasillaVerificacion
                id={`logo-${indice}-rotable`}
                checked={logos[indice]?.rotable ?? false}
                disabled={calculando}
                onChange={(valor) =>
                  setValue(`logos.${indice}.rotable`, valor, {
                    shouldValidate: true,
                  })
                }
              >
                Rotable
                <span className="ml-1 text-muted-foreground">
                  (el diseño admite girar 90° para aprovechar el rollo)
                </span>
              </CasillaVerificacion>
            </div>
          );
        })}

        {errorLista && <Aviso tono="danger">{errorLista}</Aviso>}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={calculando || fields.length >= MAX_LOGOS_COMPOSICION}
          onClick={() => append({ ...LOGO_VACIO })}
        >
          + Añadir logo
        </Button>
      </fieldset>

      <CasillaVerificacion
        id="incluir_vectorizacion"
        checked={vectorizacion}
        disabled={calculando}
        onChange={(valor) => setValue("incluir_vectorizacion", valor)}
      >
        Incluir vectorización del diseño (una sola vez por línea)
        {vectorizacion && (
          <span className="ml-1 font-medium text-foreground">
            (+{formatEuros(parametros.vectorizacion)})
          </span>
        )}
      </CasillaVerificacion>

      <PreviewComposicion
        preview={preview}
        cargando={calculandoPreview}
        error={errorPreview}
      />

      {errorMotor && <Aviso tono="danger">{errorMotor}</Aviso>}

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

// ---------------------------------------------------------------------------
// Cálculo en vivo
// ---------------------------------------------------------------------------

/**
 * Recalcula la composición en el servidor cada vez que cambian los logos.
 *
 * Debounce de 300 ms para no lanzar una Server Action por pulsación, y
 * descarte de respuestas obsoletas por contador: una petición lenta no debe
 * pisar el resultado de otra posterior.
 */
function usePreviewComposicion(
  presupuestoId: string,
  cantidad: number,
  logos: LogoDTFWizard[] | undefined,
) {
  const [preview, setPreview] = useState<PreviewComposicionDTF | null>(null);
  const [errorPreview, setErrorPreview] = useState<string | null>(null);
  const [calculandoPreview, setCalculandoPreview] = useState(false);
  const peticion = useRef(0);

  // Serializado: `logos` es un array nuevo en cada render de react-hook-form,
  // así que comparar por referencia dispararía el efecto sin parar.
  const clave = JSON.stringify(logos ?? []);

  const calcular = useCallback(async () => {
    const lista: LogoDTFWizard[] = JSON.parse(clave);
    const completos = lista.filter(
      (logo) =>
        Number.isFinite(logo.ancho_cm) &&
        logo.ancho_cm > 0 &&
        Number.isFinite(logo.alto_cm) &&
        logo.alto_cm > 0,
    );

    // Mientras falte alguna medida no se calcula nada: un preview a medias
    // confundiría más que ayudar.
    if (!completos.length || completos.length !== lista.length) {
      setPreview(null);
      setErrorPreview(null);
      setCalculandoPreview(false);
      return;
    }

    const id = ++peticion.current;
    setCalculandoPreview(true);
    const resultado = await previsualizarComposicionDTF(presupuestoId, {
      cantidad,
      logos: completos,
    });
    if (id !== peticion.current) return;

    setCalculandoPreview(false);
    if (resultado.ok) {
      setPreview(resultado.datos);
      setErrorPreview(null);
    } else {
      setPreview(null);
      setErrorPreview(resultado.error);
    }
  }, [clave, cantidad, presupuestoId]);

  useEffect(() => {
    const temporizador = setTimeout(calcular, DEBOUNCE_MS);
    return () => clearTimeout(temporizador);
  }, [calcular]);

  return { preview, errorPreview, calculandoPreview };
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="font-medium text-foreground">{valor}</dd>
    </div>
  );
}

function PreviewComposicion({
  preview,
  cargando,
  error,
}: {
  preview: PreviewComposicionDTF | null;
  cargando: boolean;
  error: string | null;
}) {
  if (error) return <Aviso tono="danger">{error}</Aviso>;
  if (!preview) {
    return (
      <p className="text-sm text-muted-foreground">
        {cargando
          ? "Calculando…"
          : "Rellena las medidas de todos los logos para ver el cálculo."}
      </p>
    );
  }

  return (
    <div
      aria-live="polite"
      className={`rounded-lg border border-border p-4 ${cargando ? "opacity-60" : ""}`}
    >
      <h3 className="mb-2 text-sm font-medium text-foreground">
        Preview del cálculo
      </h3>
      <dl className="text-sm">
        <Dato
          etiqueta="Cantidad total de logos"
          valor={String(preview.cantidad_total_logos)}
        />
        <Dato
          etiqueta="Metros de rollo"
          valor={`${formatMedida(preview.metros_necesarios)} m`}
        />
        {preview.eficiencia_pct !== null && (
          <Dato
            etiqueta="Aprovechamiento del rollo"
            valor={`${formatMedida(preview.eficiencia_pct)} %`}
          />
        )}
        <div className="my-2 border-t border-border" />
        <Dato
          etiqueta="Coste interno"
          valor={formatEuros(preview.coste_interno)}
        />
        <Dato
          etiqueta="Margen aplicado"
          valor={`${preview.margen_aplicado_pct} %`}
        />
        <Dato
          etiqueta="Importe de la línea"
          valor={formatEuros(preview.precio_total)}
        />
        <Dato
          etiqueta="Precio medio por logo"
          valor={formatEuros(preview.precio_promedio_por_logo)}
        />
        <Dato
          etiqueta="Precio por prenda"
          valor={formatEuros(preview.precio_por_prenda)}
        />
      </dl>

      {preview.aplicado_minimo && (
        <p className="mt-2 text-xs text-muted-foreground">
          Se ha aplicado el mínimo de trabajo configurado para DTF.
        </p>
      )}

      {/* Los avisos del bin packing NO bloquean: son sugerencias de ahorro. */}
      {preview.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {preview.warnings.map((aviso) => (
            <li key={aviso}>
              <Aviso tono="warning">{aviso}</Aviso>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
