"use client";

import { useState } from "react";
import { actualizarTramosMargen } from "@/app/(app)/admin/margenes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TramoMargen } from "@/types/database";

interface TramoAgrupado {
  desde_cantidad: number;
  hasta_cantidad: number | null;
  idEsporadico: string;
  idHabitual: string;
  margen_pct: number;
}

function agrupar(filas: TramoMargen[]): TramoAgrupado[] {
  const porTramo = new Map<number, TramoAgrupado>();
  for (const fila of filas) {
    const existente = porTramo.get(fila.desde_cantidad);
    const parcial = existente ?? {
      desde_cantidad: fila.desde_cantidad,
      hasta_cantidad: fila.hasta_cantidad,
      idEsporadico: "",
      idHabitual: "",
      margen_pct: fila.margen_pct,
    };
    if (fila.tipo_cliente === "esporadico") parcial.idEsporadico = fila.id;
    if (fila.tipo_cliente === "habitual") parcial.idHabitual = fila.id;
    porTramo.set(fila.desde_cantidad, parcial);
  }
  return Array.from(porTramo.values()).sort(
    (a, b) => a.desde_cantidad - b.desde_cantidad,
  );
}

interface TramosMargenTableProps {
  filas: TramoMargen[];
}

export function TramosMargenTable({ filas }: TramosMargenTableProps) {
  const tramos = agrupar(filas);
  const [valores, setValores] = useState<Record<number, number>>(
    Object.fromEntries(tramos.map((t) => [t.desde_cantidad, t.margen_pct])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);

    const payload = tramos.flatMap((tramo) => {
      const margen = valores[tramo.desde_cantidad];
      return [
        { id: tramo.idEsporadico, margen_pct: margen },
        { id: tramo.idHabitual, margen_pct: margen },
      ];
    });

    const resultado = await actualizarTramosMargen(payload);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tramo (uds.)</TableHead>
              <TableHead>Margen (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tramos.map((tramo) => (
              <TableRow key={tramo.desde_cantidad}>
                <TableCell className="text-muted-foreground">
                  {tramo.desde_cantidad}
                  {tramo.hasta_cantidad ? `-${tramo.hasta_cantidad}` : "+"}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.1"
                    className="w-24"
                    value={valores[tramo.desde_cantidad] ?? 0}
                    onChange={(evento) => {
                      setValores((anterior) => ({
                        ...anterior,
                        [tramo.desde_cantidad]: Number(evento.target.value),
                      }));
                      setGuardado(false);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {guardado && !error && <p className="text-sm text-success">Guardado ✓</p>}

      <Button type="button" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
