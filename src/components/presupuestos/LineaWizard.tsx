"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { añadirLinea, editarLinea, previsualizarLinea } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOMBRE_TECNICA } from "@/lib/presupuestos/descripciones";
import { cn } from "@/lib/utils";
import type { CodigoTecnica, ColorGrupo, TipoCliente } from "@/types/database";
import type {
  DatosLineaWizard,
  DetallesTecnica,
  ParametrosWizard,
  PreviewLinea as DatosPreviewLinea,
} from "@/types/presupuestos";
import { Aviso, BotonesPaso, Campo } from "./campos";
import { FormularioDetallesBordado } from "./FormularioDetallesBordado";
import { FormularioDetallesDTF } from "./FormularioDetallesDTF";
import { FormularioDetallesImpresionDirecta } from "./FormularioDetallesImpresionDirecta";
import { FormularioDetallesSerigrafia } from "./FormularioDetallesSerigrafia";
import { FormularioDetallesSublimacion } from "./FormularioDetallesSublimacion";
import { PreviewLinea } from "./PreviewLinea";
import { SelectorPrenda, type PrendaOpcion } from "./SelectorPrenda";
import { SelectorTecnica } from "./SelectorTecnica";
import { WizardStepper } from "./WizardStepper";

const PASOS = ["Cliente", "Técnica", "Prenda y cantidad", "Detalles", "Resumen"];

const COLORES_GRUPO: { valor: ColorGrupo; etiqueta: string }[] = [
  { valor: "blanco", etiqueta: "Blanco" },
  { valor: "color", etiqueta: "Color" },
  { valor: "oscuro", etiqueta: "Oscuro" },
];

interface LineaWizardProps {
  presupuestoId: string;
  numeroPresupuesto: string;
  nombreCliente: string;
  tipoCliente: TipoCliente;
  descuentoBordadoPct: number;
  prendas: PrendaOpcion[];
  parametros: ParametrosWizard;
  /** Presente cuando se está editando una línea existente. */
  lineaId?: string;
  valorInicial?: DatosLineaWizard;
}

export function LineaWizard({
  presupuestoId,
  numeroPresupuesto,
  nombreCliente,
  tipoCliente,
  descuentoBordadoPct,
  prendas,
  parametros,
  lineaId,
  valorInicial,
}: LineaWizardProps) {
  const router = useRouter();
  const esEdicion = Boolean(lineaId);

  const [paso, setPaso] = useState(esEdicion ? 3 : 2);
  const [tecnica, setTecnica] = useState<CodigoTecnica | null>(
    valorInicial?.detalles.tecnica ?? null,
  );
  const [conPrenda, setConPrenda] = useState(Boolean(valorInicial?.prenda_id));
  const [prendaId, setPrendaId] = useState<string | null>(
    valorInicial?.prenda_id ?? null,
  );
  const [colorGrupo, setColorGrupo] = useState<ColorGrupo>(
    valorInicial?.color_grupo ?? "color",
  );
  const [color, setColor] = useState(valorInicial?.color ?? "");
  const [cantidad, setCantidad] = useState<string>(
    valorInicial ? String(valorInicial.cantidad) : "",
  );
  const [detalles, setDetalles] = useState<DetallesTecnica | null>(
    valorInicial?.detalles ?? null,
  );
  const [preview, setPreview] = useState<DatosPreviewLinea | null>(null);
  const [errorMotor, setErrorMotor] = useState<string | null>(null);
  const [errorPaso3, setErrorPaso3] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cantidadNumero = Number.parseInt(cantidad, 10);
  const cantidadValida = Number.isInteger(cantidadNumero) && cantidadNumero > 0;

  function construirDatos(detallesFinales: DetallesTecnica): DatosLineaWizard {
    return {
      cantidad: cantidadNumero,
      prenda_id: conPrenda ? prendaId : null,
      color: conPrenda ? color.trim() || null : null,
      color_grupo: conPrenda ? colorGrupo : null,
      detalles: detallesFinales,
    };
  }

  async function calcular(detallesFinales: DetallesTecnica) {
    setOcupado(true);
    setErrorMotor(null);
    const resultado = await previsualizarLinea(
      presupuestoId,
      construirDatos(detallesFinales),
    );
    setOcupado(false);

    if (!resultado.ok) {
      setErrorMotor(resultado.error);
      return;
    }

    setDetalles(detallesFinales);
    setPreview(resultado.datos);
    setPaso(5);
  }

  async function guardar() {
    if (!detalles) return;
    setOcupado(true);
    setErrorMotor(null);

    const datos = construirDatos(detalles);
    const resultado = lineaId
      ? await editarLinea(lineaId, datos)
      : await añadirLinea(presupuestoId, datos);

    if (!resultado.ok) {
      setOcupado(false);
      setErrorMotor(resultado.error);
      return;
    }

    router.push(`/presupuestos/${presupuestoId}`);
    router.refresh();
  }

  const propsFormulario = {
    parametros,
    errorMotor,
    calculando: ocupado,
    onVolver: () => {
      setErrorMotor(null);
      setPaso(3);
    },
    onContinuar: calcular,
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link
          href={`/presupuestos/${presupuestoId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al presupuesto {numeroPresupuesto}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {esEdicion ? "Editar línea" : "Añadir línea"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cliente: {nombreCliente} ·{" "}
          {tipoCliente === "habitual" ? "Cliente habitual" : "Cliente esporádico"}
        </p>
      </div>

      <WizardStepper pasos={PASOS} actual={paso} />

      {paso === 2 && (
        <section aria-labelledby="titulo-paso-2" className="space-y-4">
          <h2 id="titulo-paso-2" className="text-lg font-medium text-foreground">
            ¿Qué técnica se va a aplicar?
          </h2>
          <SelectorTecnica
            sublimacionDisponible={parametros.sublimacion_disponible}
            seleccionada={tecnica}
            onSeleccionar={(codigo) => {
              setTecnica(codigo);
              setDetalles(null);
              setErrorMotor(null);
              setPaso(3);
            }}
          />
        </section>
      )}

      {paso === 3 && (
        <section aria-labelledby="titulo-paso-3" className="space-y-6">
          <h2 id="titulo-paso-3" className="text-lg font-medium text-foreground">
            Prenda y cantidad
          </h2>

          <Campo label="¿Añadir prenda al presupuesto?">
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="con-prenda"
                  checked={conPrenda}
                  onChange={() => setConPrenda(true)}
                />
                Sí, vendemos la prenda
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="con-prenda"
                  checked={!conPrenda}
                  onChange={() => {
                    setConPrenda(false);
                    setPrendaId(null);
                  }}
                />
                No, el cliente aporta la prenda
              </label>
            </div>
          </Campo>

          {conPrenda && (
            <>
              <SelectorPrenda
                prendas={prendas}
                prendaId={prendaId}
                onSeleccionar={(prenda) => setPrendaId(prenda.id)}
              />

              <div className="grid max-w-lg gap-4 sm:grid-cols-2">
                <Campo label="Grupo de color">
                  <div className="flex gap-2" role="radiogroup">
                    {COLORES_GRUPO.map((grupo) => (
                      <button
                        key={grupo.valor}
                        type="button"
                        role="radio"
                        aria-checked={colorGrupo === grupo.valor}
                        onClick={() => setColorGrupo(grupo.valor)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors",
                          colorGrupo === grupo.valor
                            ? "border-ancora-primary bg-ancora-primary-light font-medium text-ancora-primary-dark"
                            : "border-border text-muted-foreground hover:bg-accent/60",
                        )}
                      >
                        {grupo.etiqueta}
                      </button>
                    ))}
                  </div>
                </Campo>

                <Campo htmlFor="color" label="Color concreto">
                  <Input
                    id="color"
                    value={color}
                    onChange={(evento) => setColor(evento.target.value)}
                    placeholder="azul marino, granate…"
                  />
                </Campo>
              </div>
            </>
          )}

          <Campo
            htmlFor="cantidad"
            label="Cantidad de unidades"
            className="max-w-[12rem]"
          >
            <Input
              id="cantidad"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
            />
          </Campo>

          {errorPaso3 && <Aviso tono="danger">{errorPaso3}</Aviso>}

          <BotonesPaso>
            <Button
              type="button"
              disabled={!cantidadValida}
              onClick={() => {
                if (conPrenda && !prendaId) {
                  setErrorPaso3("Selecciona una prenda del catálogo o marca “el cliente aporta la prenda”.");
                  return;
                }
                setErrorPaso3(null);
                setPaso(4);
              }}
            >
              Continuar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaso(2)}
              disabled={esEdicion}
              title={
                esEdicion ? "La técnica no se cambia al editar una línea" : undefined
              }
            >
              Volver
            </Button>
          </BotonesPaso>
        </section>
      )}

      {paso === 4 && tecnica && (
        <section aria-labelledby="titulo-paso-4" className="space-y-6">
          <h2 id="titulo-paso-4" className="text-lg font-medium text-foreground">
            Detalles de {NOMBRE_TECNICA[tecnica].toLowerCase()}
          </h2>

          {tecnica === "DTF" && (
            <FormularioDetallesDTF
              valorInicial={
                detalles?.tecnica === "DTF" ? detalles : null
              }
              {...propsFormulario}
            />
          )}
          {tecnica === "BORDADO" && (
            <FormularioDetallesBordado
              valorInicial={detalles?.tecnica === "BORDADO" ? detalles : null}
              descuentoBordadoPct={
                tipoCliente === "habitual" ? descuentoBordadoPct : 0
              }
              {...propsFormulario}
            />
          )}
          {tecnica === "SERIGRAFIA" && (
            <FormularioDetallesSerigrafia
              valorInicial={detalles?.tecnica === "SERIGRAFIA" ? detalles : null}
              {...propsFormulario}
            />
          )}
          {tecnica === "IMPRESION_DIRECTA" && (
            <FormularioDetallesImpresionDirecta
              valorInicial={
                detalles?.tecnica === "IMPRESION_DIRECTA" ? detalles : null
              }
              {...propsFormulario}
            />
          )}
          {tecnica === "SUBLIMACION" && (
            <FormularioDetallesSublimacion
              valorInicial={detalles?.tecnica === "SUBLIMACION" ? detalles : null}
              errorMotor={errorMotor}
              calculando={ocupado}
              onVolver={() => {
                setErrorMotor(null);
                setPaso(3);
              }}
              onContinuar={calcular}
            />
          )}
        </section>
      )}

      {paso === 5 && preview && (
        <section aria-labelledby="titulo-paso-5" className="space-y-6">
          <h2 id="titulo-paso-5" className="text-lg font-medium text-foreground">
            Resumen de la línea
          </h2>

          <PreviewLinea preview={preview} />

          {errorMotor && <Aviso tono="danger">{errorMotor}</Aviso>}

          <BotonesPaso>
            <Button type="button" onClick={guardar} disabled={ocupado}>
              {ocupado
                ? "Guardando…"
                : esEdicion
                  ? "Guardar cambios"
                  : "Añadir al presupuesto"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => {
                setPreview(null);
                setPaso(4);
              }}
            >
              Cancelar
            </Button>
          </BotonesPaso>
        </section>
      )}
    </div>
  );
}
