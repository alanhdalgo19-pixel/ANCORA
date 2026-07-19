"use client";

import { useState } from "react";
import { actualizarTiposPicaje } from "@/app/(app)/admin/tarifas/picaje/actions";
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
import type { TipoPicaje } from "@/types/database";

interface TiposPicajeTableProps {
  tipos: TipoPicaje[];
}

export function TiposPicajeTable({ tipos }: TiposPicajeTableProps) {
  const [valores, setValores] = useState<Record<string, number>>(
    Object.fromEntries(tipos.map((t) => [t.id, t.precio_base])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const payload = tipos.map((t) => ({ id: t.id, precio_base: valores[t.id] }));
    const resultado = await actualizarTiposPicaje(payload);
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
              <TableHead>Tipo</TableHead>
              <TableHead>Precio base (€)</TableHead>
              <TableHead>Editable en presupuesto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.map((tipo) => (
              <TableRow key={tipo.id}>
                <TableCell className="font-medium">{tipo.nombre}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-28"
                    value={valores[tipo.id] ?? 0}
                    onChange={(evento) => {
                      setValores((anterior) => ({
                        ...anterior,
                        [tipo.id]: Number(evento.target.value),
                      }));
                      setGuardado(false);
                    }}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tipo.editable_en_presupuesto ? "Sí" : "No"}
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
