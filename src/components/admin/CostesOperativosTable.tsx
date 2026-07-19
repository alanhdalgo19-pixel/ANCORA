"use client";

import { useState } from "react";
import { actualizarCostesOperativos } from "@/app/(app)/admin/costes/actions";
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
import type { CosteOperativo } from "@/types/database";

interface CostesOperativosTableProps {
  costes: CosteOperativo[];
}

export function CostesOperativosTable({ costes }: CostesOperativosTableProps) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(costes.map((c) => [c.clave, c.valor?.toString() ?? ""])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const payload = costes.map((c) => {
      const texto = valores[c.clave];
      return { clave: c.clave, valor: texto === "" ? null : Number(texto) };
    });
    const resultado = await actualizarCostesOperativos(payload);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clave</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costes.map((coste) => (
              <TableRow key={coste.clave}>
                <TableCell className="font-mono text-xs">{coste.clave}</TableCell>
                <TableCell className="text-muted-foreground">
                  {coste.descripcion}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-28"
                    placeholder="PTE"
                    value={valores[coste.clave] ?? ""}
                    onChange={(evento) => {
                      setValores((anterior) => ({
                        ...anterior,
                        [coste.clave]: evento.target.value,
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
