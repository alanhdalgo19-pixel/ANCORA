"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarPresupuesto } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  presupuestoId: string;
  notas: string | null;
  transporte: number;
  descuentoManualPct: number;
}

/**
 * Notas, transporte y descuento manual. Guardado explícito con botón
 * "Guardar borrador": sin autoguardado (decisión A.4 del Prompt 6).
 */
export function AjustesPresupuestoForm({
  presupuestoId,
  notas,
  transporte,
  descuentoManualPct,
}: Props) {
  const router = useRouter();
  const [valorNotas, setValorNotas] = useState(notas ?? "");
  const [valorTransporte, setValorTransporte] = useState(String(transporte));
  const [valorDescuento, setValorDescuento] = useState(
    String(descuentoManualPct),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setGuardado(false);
    setGuardando(true);

    const resultado = await actualizarPresupuesto({
      presupuesto_id: presupuestoId,
      notas: valorNotas,
      transporte: Number(valorTransporte) || 0,
      descuento_manual_pct: Number(valorDescuento) || 0,
    });

    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    setGuardado(true);
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas del presupuesto</Label>
        <Textarea
          id="notas"
          rows={3}
          value={valorNotas}
          onChange={(evento) => {
            setValorNotas(evento.target.value);
            setGuardado(false);
          }}
          placeholder="Comentarios que verá el cliente en el PDF…"
          disabled={guardando}
        />
      </div>

      <div className="grid max-w-md grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="transporte">Transporte (€)</Label>
          <Input
            id="transporte"
            type="number"
            step="0.01"
            min={0}
            value={valorTransporte}
            onChange={(evento) => {
              setValorTransporte(evento.target.value);
              setGuardado(false);
            }}
            disabled={guardando}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="descuento">Descuento manual (%)</Label>
          <Input
            id="descuento"
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={valorDescuento}
            onChange={(evento) => {
              setValorDescuento(evento.target.value);
              setGuardado(false);
            }}
            disabled={guardando}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar borrador"}
        </Button>
        {guardado && (
          <span className="text-sm text-success">Guardado ✓</span>
        )}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
