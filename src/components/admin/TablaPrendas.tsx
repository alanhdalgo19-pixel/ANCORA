"use client";

// Listado de prendas del panel admin con la columna editable "Tipo mockup"
// (F2.3). Mismo patrón que las demás tablas del panel (Prompt 3, decisión 1):
// todos los desplegables visibles a la vez y un único "Guardar cambios".
// Solo se envían las prendas cuyo tipo ha cambiado.

import { useState } from "react";
import Link from "next/link";
import { actualizarTiposMockup } from "@/app/(app)/admin/prendas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DIMENSIONES_PRENDAS,
  TIPOS_PRENDA,
} from "@/lib/mockup/dimensiones-prendas";
import { cn } from "@/lib/utils";
import type { TipoMockup } from "@/types/database";

export interface FilaPrendaAdmin {
  id: string;
  codigo_interno: string;
  nombre: string;
  proveedor: string;
  tejido: string;
  tiene_precios: boolean;
  tipo_mockup: TipoMockup | null;
}

const SIN_TIPO = "";

export function TablaPrendas({ prendas }: { prendas: FilaPrendaAdmin[] }) {
  const [tipos, setTipos] = useState<Record<string, TipoMockup | null>>(() =>
    Object.fromEntries(prendas.map((prenda) => [prenda.id, prenda.tipo_mockup])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const cambios = prendas
    .filter((prenda) => (tipos[prenda.id] ?? null) !== prenda.tipo_mockup)
    .map((prenda) => ({ id: prenda.id, tipo_mockup: tipos[prenda.id] ?? null }));

  async function guardar() {
    setGuardando(true);
    setError(null);
    const resultado = await actualizarTiposMockup(cambios);
    setGuardando(false);
    if (resultado.error) {
      setError(resultado.error);
    } else {
      setGuardado(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Tejido</TableHead>
              <TableHead>Tipo mockup</TableHead>
              <TableHead>Precios</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prendas.length ? (
              prendas.map((prenda) => (
                <TableRow key={prenda.id}>
                  <TableCell className="font-mono text-xs">
                    {prenda.codigo_interno}
                  </TableCell>
                  <TableCell className="font-medium">{prenda.nombre}</TableCell>
                  <TableCell>{prenda.proveedor}</TableCell>
                  <TableCell>{prenda.tejido}</TableCell>
                  <TableCell>
                    <select
                      aria-label={`Tipo de mockup de ${prenda.nombre}`}
                      value={tipos[prenda.id] ?? SIN_TIPO}
                      onChange={(evento) => {
                        const valor = evento.target.value;
                        setTipos((anterior) => ({
                          ...anterior,
                          [prenda.id]:
                            valor === SIN_TIPO ? null : (valor as TipoMockup),
                        }));
                        setGuardado(false);
                      }}
                      className={cn(
                        "rounded-md border border-input bg-transparent px-2 py-1 text-sm",
                        !tipos[prenda.id] && "text-muted-foreground",
                      )}
                    >
                      <option value={SIN_TIPO}>Sin tipo (se pinta como «otra»)</option>
                      {TIPOS_PRENDA.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {DIMENSIONES_PRENDAS[tipo].nombre_visible}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={prenda.tiene_precios ? "default" : "destructive"}
                      className={cn(!prenda.tiene_precios && "bg-danger text-white")}
                    >
                      {prenda.tiene_precios ? "Con precios" : "Sin precios"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/prendas/${prenda.id}`}>Ver ficha</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay prendas que coincidan con el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {guardado && !error && <p className="text-sm text-success">Guardado ✓</p>}

      {prendas.length > 0 && (
        <Button
          type="button"
          onClick={guardar}
          disabled={guardando || cambios.length === 0}
        >
          {guardando
            ? "Guardando…"
            : cambios.length
              ? `Guardar tipos de mockup (${cambios.length})`
              : "Guardar tipos de mockup"}
        </Button>
      )}
    </div>
  );
}
