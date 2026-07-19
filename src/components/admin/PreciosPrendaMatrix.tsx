"use client";

import { useState } from "react";
import { actualizarPreciosPrenda } from "@/app/(app)/admin/prendas/actions";
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
import type { PrecioPrenda } from "@/types/database";

interface PreciosPrendaMatrixProps {
  prendaId: string;
  precios: PrecioPrenda[];
}

const GRUPOS: { valor: PrecioPrenda["color_grupo"]; etiqueta: string }[] = [
  { valor: "blanco", etiqueta: "Blanco" },
  { valor: "color", etiqueta: "Color" },
  { valor: "oscuro", etiqueta: "Oscuro" },
];

export function PreciosPrendaMatrix({ prendaId, precios }: PreciosPrendaMatrixProps) {
  const [valores, setValores] = useState<Record<string, number>>(
    Object.fromEntries(precios.map((p) => [p.id, p.precio])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function actualizarValor(id: string, valor: string) {
    setValores((anterior) => ({ ...anterior, [id]: Number(valor) }));
    setGuardado(false);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const payload = precios.map((p) => ({ id: p.id, precio: valores[p.id] }));
    const resultado = await actualizarPreciosPrenda(prendaId, payload);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {GRUPOS.map((grupo) => {
          const filasGrupo = precios
            .filter((p) => p.color_grupo === grupo.valor)
            .sort((a, b) => a.desde_cantidad - b.desde_cantidad);
          const esporadico = filasGrupo.filter((p) => p.tipo_cliente === "esporadico");
          const habitual = filasGrupo.filter((p) => p.tipo_cliente === "habitual");

          return (
            <div key={grupo.valor} className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted px-4 py-2 text-sm font-semibold text-foreground">
                {grupo.etiqueta}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tramo</TableHead>
                    <TableHead>Esporádico</TableHead>
                    <TableHead>Habitual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {esporadico.map((filaEsporadico, indice) => {
                    const filaHabitual = habitual[indice];
                    return (
                      <TableRow key={filaEsporadico.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {filaEsporadico.desde_cantidad}
                          {filaEsporadico.hasta_cantidad
                            ? `-${filaEsporadico.hasta_cantidad}`
                            : "+"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20"
                            placeholder="PTE"
                            value={valores[filaEsporadico.id] || ""}
                            onChange={(evento) =>
                              actualizarValor(filaEsporadico.id, evento.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {filaHabitual && (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-20"
                              placeholder="PTE"
                              value={valores[filaHabitual.id] || ""}
                              onChange={(evento) =>
                                actualizarValor(filaHabitual.id, evento.target.value)
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
        })}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {guardado && !error && <p className="text-sm text-success">Guardado ✓</p>}

      <Button type="button" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar precios"}
      </Button>
    </div>
  );
}
