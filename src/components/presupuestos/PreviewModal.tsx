"use client";

import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Abre el preview del PDF a pantalla casi completa.
 *
 * El contenido llega como `children` ya renderizado en el servidor: así el
 * documento sigue siendo un Server Component y este envoltorio solo aporta el
 * estado de abierto/cerrado.
 */
export function PreviewModal({
  numero,
  children,
}: {
  numero: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        <Eye className="h-4 w-4" />
        Ver preview
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-muted">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista previa del presupuesto {numero}</DialogTitle>
            <DialogDescription>
              Réplica de cómo quedará el PDF. La descarga en PDF llega en la
              siguiente entrega.
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}
