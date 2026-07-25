"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DetallesTecnica } from "@/types/presupuestos";
import type { Posicion } from "@/types/database";
import { Aviso, BotonesPaso, Campo, SelectorPosicion } from "./campos";

interface Props {
  valorInicial: Extract<DetallesTecnica, { tecnica: "SUBLIMACION" }> | null;
  errorMotor: string | null;
  calculando: boolean;
  onVolver: () => void;
  onContinuar: (detalles: DetallesTecnica) => void;
}

/**
 * La tarifa de sublimación es unitaria y fija, así que el único dato que
 * aporta el usuario es la posición. Sin RHF ni Zod: no hay nada que validar
 * más allá de un enum con valor por defecto.
 */
export function FormularioDetallesSublimacion({
  valorInicial,
  errorMotor,
  calculando,
  onVolver,
  onContinuar,
}: Props) {
  const [posicion, setPosicion] = useState<Posicion>(
    valorInicial?.posicion ?? "pecho",
  );

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        onContinuar({ tecnica: "SUBLIMACION", posicion });
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
