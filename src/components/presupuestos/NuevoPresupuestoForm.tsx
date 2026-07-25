"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearPresupuesto } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import { Aviso } from "./campos";
import {
  SelectorCliente,
  datosFiscalesIncompletos,
  type ClienteOpcion,
} from "./SelectorCliente";
import { WizardStepper } from "./WizardStepper";

const PASOS = ["Cliente", "Técnica", "Prenda y cantidad", "Detalles", "Resumen"];

export function NuevoPresupuestoForm({
  clientes,
}: {
  clientes: ClienteOpcion[];
}) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState<ClienteOpcion | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const faltan = seleccionado ? datosFiscalesIncompletos(seleccionado) : [];

  async function continuar() {
    if (!seleccionado) return;
    setError(null);
    setCreando(true);

    const resultado = await crearPresupuesto({ cliente_id: seleccionado.id });

    if (!resultado.ok) {
      setCreando(false);
      setError(resultado.error);
      return;
    }

    router.push(
      `/presupuestos/${resultado.datos.presupuesto_id}/linea/nueva`,
    );
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        href="/presupuestos"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver a presupuestos
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">
        Nuevo presupuesto
      </h1>

      <div className="mt-6">
        <WizardStepper pasos={PASOS} actual={1} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          ¿Para qué cliente es?
        </h2>

        <SelectorCliente
          clientes={clientes}
          clienteId={seleccionado?.id ?? null}
          onSeleccionar={setSeleccionado}
          disabled={creando}
        />

        {seleccionado && faltan.length > 0 && (
          <Aviso tono="warning">
            A {seleccionado.nombre} le faltan datos fiscales ({faltan.join(", ")}
            ). Puedes seguir, pero conviene completarlos en la ficha del cliente
            antes de enviar el PDF.
          </Aviso>
        )}

        {error && <Aviso tono="danger">{error}</Aviso>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={continuar}
            disabled={!seleccionado || creando}
          >
            {creando ? "Creando presupuesto…" : "Continuar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/presupuestos")}
            disabled={creando}
          >
            Cancelar
          </Button>
        </div>
      </section>
    </div>
  );
}
