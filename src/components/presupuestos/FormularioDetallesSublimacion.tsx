"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useCambioMockup,
  type AvisoCambioMockup,
} from "@/hooks/use-cambio-mockup";
import type { DetallesTecnica } from "@/types/presupuestos";
import type { Posicion } from "@/types/database";
import {
  Aviso,
  BotonesPaso,
  Campo,
  CamposMedidasMockup,
  SelectorPosicion,
} from "./campos";

interface Props {
  valorInicial: Extract<DetallesTecnica, { tecnica: "SUBLIMACION" }> | null;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
  /** F2.3 — medidas en vivo para el mockup de la columna derecha. */
  onCambioMockup?: AvisoCambioMockup;
}

/** Texto del input → número, o null si está vacío o no es válido. */
function medida(texto: string): number | null {
  const valor = Number(texto.replace(",", "."));
  return texto.trim() !== "" && Number.isFinite(valor) && valor > 0 ? valor : null;
}

/**
 * La tarifa de sublimación es unitaria y fija, así que el único dato que
 * aporta el usuario para el precio es la posición. Sin RHF ni Zod: no hay nada
 * que validar más allá de un enum con valor por defecto. Las medidas del logo
 * son opcionales y solo alimentan el mockup (F2.3).
 */
export function FormularioDetallesSublimacion({
  valorInicial,
  errorMotor,
  calculando,
  onVolver,
  onContinuar,
  onCambioMockup,
}: Props) {
  const [posicion, setPosicion] = useState<Posicion>(
    valorInicial?.posicion ?? "pecho",
  );
  const [ancho, setAncho] = useState(
    valorInicial?.ancho_logo_cm ? String(valorInicial.ancho_logo_cm) : "",
  );
  const [alto, setAlto] = useState(
    valorInicial?.alto_logo_cm ? String(valorInicial.alto_logo_cm) : "",
  );

  useCambioMockup(
    [{ ubicacion: posicion, ancho_cm: medida(ancho), alto_cm: medida(alto) }],
    onCambioMockup,
  );

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        onContinuar({
          tecnica: "SUBLIMACION",
          posicion,
          ancho_logo_cm: medida(ancho),
          alto_logo_cm: medida(alto),
        });
      }}
      className="space-y-6"
    >
      <Campo label="Ubicación">
        <SelectorPosicion
          nombre="posicion"
          valor={posicion}
          onCambiar={setPosicion}
          disabled={calculando}
        />
      </Campo>

      <CamposMedidasMockup
        idPrefijo="sublimacion-logo"
        disabled={calculando}
        propsAncho={{
          value: ancho,
          onChange: (evento) => setAncho(evento.target.value),
        }}
        propsAlto={{
          value: alto,
          onChange: (evento) => setAlto(evento.target.value),
        }}
      />

      <Aviso tono="warning">
        La tarifa de sublimación sigue pendiente de definir con Espe: el precio
        por unidad y la cantidad mínima se configuran en Admin → Tarifas →
        Sublimación.
      </Aviso>

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
