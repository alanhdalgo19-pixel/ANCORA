"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eliminarLinea } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuros } from "@/lib/format";
import {
  subdescripcionLinea,
  subdescripcionPrenda,
} from "@/lib/presupuestos/descripciones";
import type { LineaVista } from "@/types/presupuestos";
import { LineaExtra } from "./LineaExtra";

interface Props {
  presupuestoId: string;
  lineas: LineaVista[];
  editable: boolean;
}

export function TablaLineasPresupuesto({
  presupuestoId,
  lineas,
  editable,
}: Props) {
  const router = useRouter();
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function borrar(lineaId: string) {
    setError(null);
    setBorrando(lineaId);
    const resultado = await eliminarLinea(lineaId);
    setBorrando(null);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  if (!lineas.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Este presupuesto todavía no tiene líneas.
        </p>
        {editable && (
          <Button asChild className="mt-4">
            <Link href={`/presupuestos/${presupuestoId}/linea/nueva`}>
              Añadir la primera línea
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24 text-right">Cantidad</TableHead>
              <TableHead className="w-32 text-right">Precio ud.</TableHead>
              <TableHead className="w-32 text-right">Importe</TableHead>
              {editable && <TableHead className="w-40" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.map((linea) => {
              const detalle =
                linea.tipo_linea === "prenda"
                  ? subdescripcionPrenda(linea.detalle_calculo)
                  : subdescripcionLinea(linea.detalle_calculo);

              return (
                <TableRow key={linea.id}>
                  <TableCell>
                    {linea.tipo_linea === "extra" ? (
                      <LineaExtra linea={linea} />
                    ) : (
                      <>
                        <span className="text-sm font-medium text-foreground">
                          {linea.descripcion}
                        </span>
                        {detalle && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {detalle}
                          </span>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {linea.tipo_linea === "extra" ? "—" : linea.cantidad}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {linea.tipo_linea === "extra"
                      ? "—"
                      : formatEuros(linea.precio_unitario)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatEuros(linea.importe_linea)}
                  </TableCell>
                  {editable && (
                    <TableCell className="text-right">
                      {linea.tipo_linea === "tecnica" && (
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/presupuestos/${presupuestoId}/linea/${linea.id}/editar`}
                            >
                              Editar
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            disabled={borrando === linea.id}
                            onClick={() => borrar(linea.id)}
                          >
                            {borrando === linea.id ? "Eliminando…" : "Eliminar"}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editable && (
        <p className="text-xs text-muted-foreground">
          Al eliminar una personalización se borran también la prenda y los
          extras que se añadieron con ella.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
