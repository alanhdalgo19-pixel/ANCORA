"use client";

import { useState } from "react";
import { actualizarTarifasSerigrafia } from "@/app/(app)/admin/tarifas/serigrafia/actions";
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
import type { TarifaSerigrafia } from "@/types/database";

interface TarifasSerigrafiaTableProps {
  filas: TarifaSerigrafia[];
}

function etiquetaTramo(fila: TarifaSerigrafia) {
  return `${fila.desde_cantidad}-${fila.hasta_cantidad}`;
}

export function TarifasSerigrafiaTable({ filas }: TarifasSerigrafiaTableProps) {
  const [valores, setValores] = useState<Record<string, number>>(
    Object.fromEntries(filas.map((f) => [f.id, f.precio_unitario])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const pecho = filas.filter((f) => f.ubicacion === "pecho");
  const espalda = filas.filter((f) => f.ubicacion === "espalda");

  function actualizarValor(id: string, valor: string) {
    setValores((anterior) => ({ ...anterior, [id]: Number(valor) }));
    setGuardado(false);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const payload = filas.map((f) => ({ id: f.id, precio_unitario: valores[f.id] }));
    const resultado = await actualizarTarifasSerigrafia(payload);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  function Bloque({ titulo, grupo }: { titulo: string; grupo: TarifaSerigrafia[] }) {
    const unColor = grupo.filter((f) => f.num_colores === 1);
    const dosColores = grupo.filter((f) => f.num_colores === 2);

    return (
      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground">
          {titulo}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tramo (uds.)</TableHead>
              <TableHead>1 color (€/ud.)</TableHead>
              <TableHead>2 colores (€/ud.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unColor.map((filaUnColor, indice) => {
              const filaDosColores = dosColores[indice];
              return (
                <TableRow key={filaUnColor.id}>
                  <TableCell className="text-muted-foreground">
                    {etiquetaTramo(filaUnColor)}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={valores[filaUnColor.id] ?? 0}
                      onChange={(evento) =>
                        actualizarValor(filaUnColor.id, evento.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {filaDosColores && (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        value={valores[filaDosColores.id] ?? 0}
                        onChange={(evento) =>
                          actualizarValor(filaDosColores.id, evento.target.value)
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloque titulo="Pecho" grupo={pecho} />
        <Bloque titulo="Espalda" grupo={espalda} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {guardado && !error && <p className="text-sm text-success">Guardado ✓</p>}

      <Button type="button" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar tarifa"}
      </Button>
    </div>
  );
}
