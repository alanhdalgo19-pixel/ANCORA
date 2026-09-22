"use client";

// F2.2 — controles de la pantalla de prueba del mockup.
//
// Panel izquierdo: cliente, logo, prenda, color, ubicación, medidas y opciones.
// Panel derecho: el `<Mockup>` y los datos técnicos del layout.
//
// La vista previa va con 200 ms de debounce: mientras Alan teclea "25" en el
// ancho no se repinta con "2". Los logos se cargan por Server Action al cambiar
// de cliente, con el mismo guardado contra respuestas desordenadas que usa la
// exportación del Prompt 9.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Mockup } from "@/components/mockup/Mockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ColorGrupo, Ubicacion } from "@/lib/calculos/types";
import {
  ALTO_PIXELS_POR_DEFECTO,
  calcularLayoutMockup,
} from "@/lib/mockup/calcular-layout";
import {
  DIMENSIONES_PRENDAS,
  TIPOS_PRENDA,
  type TipoPrenda,
} from "@/lib/mockup/dimensiones-prendas";
import { cargarLogosCliente, type LogoParaMockup } from "./actions";

export interface ClienteConLogos {
  id: string;
  nombre: string;
  num_logos: number;
}

interface Props {
  clientes: ClienteConLogos[];
  clienteInicialId: string | null;
  logosIniciales: LogoParaMockup[];
}

interface ParametrosVista {
  tipoPrenda: TipoPrenda;
  color: ColorGrupo;
  ubicacion: Ubicacion;
  ancho: number;
  alto: number;
  altoPixels: number;
  logoUrl: string | null;
  mostrarDimensiones: boolean;
  mostrarArea: boolean;
}

const MILISEGUNDOS_DEBOUNCE = 200;

const CLASE_CAMPO =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

const OPCIONES_COLOR: { valor: ColorGrupo; etiqueta: string }[] = [
  { valor: "blanco", etiqueta: "Blanco" },
  { valor: "color", etiqueta: "Color" },
  { valor: "oscuro", etiqueta: "Oscuro" },
];

const OPCIONES_UBICACION: { valor: Ubicacion; etiqueta: string }[] = [
  { valor: "pecho", etiqueta: "Pecho" },
  { valor: "espalda", etiqueta: "Espalda" },
  { valor: "manga", etiqueta: "Manga" },
  { valor: "otro", etiqueta: "Otro" },
];

const PRESETS: {
  nombre: string;
  ubicacion: Ubicacion;
  ancho: number;
  alto: number;
}[] = [
  { nombre: "Pecho estándar", ubicacion: "pecho", ancho: 9, alto: 4 },
  { nombre: "Espalda grande", ubicacion: "espalda", ancho: 25, alto: 30 },
  { nombre: "Manga pequeña", ubicacion: "manga", ancho: 6, alto: 3 },
  { nombre: "Logo demasiado grande", ubicacion: "pecho", ancho: 20, alto: 25 },
];

/** El logo principal si se puede pintar; si no, el primero que se pueda. */
function logoPorDefecto(logos: LogoParaMockup[]): string {
  const pintables = logos.filter((logo) => logo.previsualizable);
  return (pintables.find((logo) => logo.es_principal) ?? pintables[0])?.id ?? "";
}

function aNumero(valor: string): number {
  return Number(valor.replace(",", "."));
}

const FORMATO_DECIMAL = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

export function SelectorMockup({
  clientes,
  clienteInicialId,
  logosIniciales,
}: Props) {
  const [clienteId, setClienteId] = useState(clienteInicialId ?? "");
  const [logos, setLogos] = useState(logosIniciales);
  const [logoId, setLogoId] = useState(() => logoPorDefecto(logosIniciales));
  const [cargandoLogos, setCargandoLogos] = useState(false);
  const [errorLogos, setErrorLogos] = useState<string | null>(null);

  const [tipoPrenda, setTipoPrenda] = useState<TipoPrenda>("polo");
  const [color, setColor] = useState<ColorGrupo>("color");
  const [ubicacion, setUbicacion] = useState<Ubicacion>("pecho");
  const [ancho, setAncho] = useState("9");
  const [alto, setAlto] = useState("4");
  const [altoPixels, setAltoPixels] = useState(String(ALTO_PIXELS_POR_DEFECTO));
  const [mostrarDimensiones, setMostrarDimensiones] = useState(true);
  const [mostrarArea, setMostrarArea] = useState(true);

  const peticionActual = useRef(0);

  async function cambiarCliente(nuevoId: string) {
    setClienteId(nuevoId);
    setErrorLogos(null);

    const identificador = peticionActual.current + 1;
    peticionActual.current = identificador;

    if (!nuevoId) {
      setLogos([]);
      setLogoId("");
      return;
    }

    setCargandoLogos(true);
    const resultado = await cargarLogosCliente(nuevoId);
    if (peticionActual.current !== identificador) return;

    setCargandoLogos(false);
    if (resultado.ok) {
      setLogos(resultado.datos);
      setLogoId(logoPorDefecto(resultado.datos));
    } else {
      setLogos([]);
      setLogoId("");
      setErrorLogos(resultado.error);
    }
  }

  function aplicarPreset(preset: (typeof PRESETS)[number]) {
    setUbicacion(preset.ubicacion);
    setAncho(String(preset.ancho));
    setAlto(String(preset.alto));
  }

  const logoSeleccionado = logos.find((logo) => logo.id === logoId) ?? null;

  const parametros = useMemo<ParametrosVista>(
    () => ({
      tipoPrenda,
      color,
      ubicacion,
      ancho: aNumero(ancho),
      alto: aNumero(alto),
      altoPixels: aNumero(altoPixels),
      logoUrl: logoSeleccionado?.url ?? null,
      mostrarDimensiones,
      mostrarArea,
    }),
    [
      tipoPrenda,
      color,
      ubicacion,
      ancho,
      alto,
      altoPixels,
      logoSeleccionado,
      mostrarDimensiones,
      mostrarArea,
    ],
  );

  const [vista, setVista] = useState(parametros);
  useEffect(() => {
    const temporizador = setTimeout(
      () => setVista(parametros),
      MILISEGUNDOS_DEBOUNCE,
    );
    return () => clearTimeout(temporizador);
  }, [parametros]);

  // Mismo cálculo que hace `<Mockup>` por dentro, solo para enseñar los datos
  // técnicos. Es una función pura y barata: repetirla no cuesta nada.
  const layout = calcularLayoutMockup({
    tipo_prenda: vista.tipoPrenda,
    color_prenda: vista.color,
    logo_url: vista.logoUrl,
    logo_ancho_cm: vista.ancho,
    logo_alto_cm: vista.alto,
    ubicacion: vista.ubicacion,
    alto_pixels: vista.altoPixels,
  });

  return (
    <div className="grid gap-6 md:grid-cols-[320px_1fr]">
      {/* Panel de controles */}
      <section
        aria-label="Parámetros del mockup"
        className="space-y-4 rounded-lg border border-border p-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="cliente">Cliente</Label>
          <select
            id="cliente"
            value={clienteId}
            onChange={(evento) => cambiarCliente(evento.target.value)}
            className={CLASE_CAMPO}
          >
            <option value="">— Sin cliente —</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre} ({cliente.num_logos}{" "}
                {cliente.num_logos === 1 ? "logo" : "logos"})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="logo" className="flex items-center gap-2">
            Logo
            {cargandoLogos && (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-muted-foreground"
                aria-label="Cargando logos"
              />
            )}
          </Label>
          <select
            id="logo"
            value={logoId}
            onChange={(evento) => setLogoId(evento.target.value)}
            disabled={cargandoLogos}
            className={CLASE_CAMPO}
          >
            <option value="">— Sin logo —</option>
            {logos.map((logo) => (
              <option
                key={logo.id}
                value={logo.id}
                disabled={!logo.previsualizable}
              >
                {logo.nombre}
                {logo.es_principal ? " ★" : ""}
                {logo.previsualizable ? "" : " (PDF, no previsualizable)"}
              </option>
            ))}
          </select>
          {errorLogos && <p className="text-sm text-danger">{errorLogos}</p>}
          {clienteId && !cargandoLogos && !errorLogos && logos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Este cliente no tiene logos guardados.
            </p>
          )}
          {logoSeleccionado && (
            <div className="flex h-20 items-center justify-center rounded-md border border-border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, next/image no puede optimizarla */}
              <img
                src={logoSeleccionado.url}
                alt={`Logo ${logoSeleccionado.nombre}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prenda">Tipo de prenda</Label>
          <select
            id="prenda"
            value={tipoPrenda}
            onChange={(evento) => setTipoPrenda(evento.target.value as TipoPrenda)}
            className={CLASE_CAMPO}
          >
            {TIPOS_PRENDA.map((tipo) => {
              const prenda = DIMENSIONES_PRENDAS[tipo];
              return (
                <option key={tipo} value={tipo}>
                  {prenda.nombre_visible} ({prenda.ancho_cm} × {prenda.alto_cm} cm)
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <select
              id="color"
              value={color}
              onChange={(evento) => setColor(evento.target.value as ColorGrupo)}
              className={CLASE_CAMPO}
            >
              {OPCIONES_COLOR.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ubicacion">Ubicación</Label>
            <select
              id="ubicacion"
              value={ubicacion}
              onChange={(evento) => setUbicacion(evento.target.value as Ubicacion)}
              className={CLASE_CAMPO}
            >
              {OPCIONES_UBICACION.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ancho">Ancho (cm)</Label>
            <Input
              id="ancho"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.5}
              value={ancho}
              onChange={(evento) => setAncho(evento.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alto">Alto (cm)</Label>
            <Input
              id="alto"
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.5}
              value={alto}
              onChange={(evento) => setAlto(evento.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="alto-pixels">Alto del mockup en pantalla (px)</Label>
          <Input
            id="alto-pixels"
            type="number"
            min={100}
            max={1200}
            step={50}
            value={altoPixels}
            onChange={(evento) => setAltoPixels(evento.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">Opciones de dibujo</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mostrarDimensiones}
              onChange={(evento) => setMostrarDimensiones(evento.target.checked)}
              className="h-4 w-4 accent-ancora-primary"
            />
            Mostrar medidas del logo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mostrarArea}
              onChange={(evento) => setMostrarArea(evento.target.checked)}
              className="h-4 w-4 accent-ancora-primary"
            />
            Mostrar área imprimible
          </label>
        </fieldset>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Presets
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.nombre}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarPreset(preset)}
                className="h-auto whitespace-normal py-1.5 text-xs"
              >
                {preset.nombre}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Vista previa */}
      <section aria-label="Vista previa del mockup" className="space-y-4">
        <div className="flex justify-center overflow-x-auto rounded-lg border border-border bg-muted/30 p-6">
          <Mockup
            tipo_prenda={vista.tipoPrenda}
            color_prenda={vista.color}
            logo_url={vista.logoUrl}
            logo_ancho_cm={vista.ancho}
            logo_alto_cm={vista.alto}
            ubicacion={vista.ubicacion}
            alto_pixels={vista.altoPixels}
            mostrar_dimensiones={vista.mostrarDimensiones}
            mostrar_area_imprimible={vista.mostrarArea}
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm sm:grid-cols-3">
          <DatoTecnico
            etiqueta="Escala"
            valor={`${FORMATO_DECIMAL.format(layout.escala_px_por_cm)} px/cm`}
          />
          <DatoTecnico
            etiqueta="Tamaño SVG"
            valor={`${Math.round(layout.svg_ancho_px)} × ${Math.round(layout.svg_alto_px)} px`}
          />
          <DatoTecnico
            etiqueta="Prenda"
            valor={`${layout.prenda.ancho_cm} × ${layout.prenda.alto_cm} cm`}
          />
          <DatoTecnico
            etiqueta="Área imprimible"
            valor={
              layout.area.disponible
                ? `${layout.area.ancho_cm} × ${layout.area.alto_cm} cm`
                : "No disponible"
            }
          />
          <DatoTecnico
            etiqueta="Logo en SVG"
            valor={
              layout.logo
                ? `${Math.round(layout.logo.ancho_px)} × ${Math.round(layout.logo.alto_px)} px`
                : "—"
            }
          />
          <DatoTecnico
            etiqueta="Warnings"
            valor={
              layout.warnings.length === 0
                ? "Ninguno"
                : String(layout.warnings.length)
            }
          />
        </dl>
      </section>
    </div>
  );
}

function DatoTecnico({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="font-medium tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}
