"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { crearClienteRapido } from "@/app/(app)/presupuestos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TipoClienteBadge } from "@/components/clientes/TipoClienteBadge";
import { cn } from "@/lib/utils";
import type { TipoCliente } from "@/types/database";

export interface ClienteOpcion {
  id: string;
  nombre: string;
  cif: string | null;
  localidad: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  tipo_cliente: TipoCliente;
  descuento_bordado_pct: number;
}

interface SelectorClienteProps {
  clientes: ClienteOpcion[];
  clienteId: string | null;
  onSeleccionar: (cliente: ClienteOpcion) => void;
  disabled?: boolean;
}

/** Campos fiscales que hacen falta para un PDF completo (CLAUDE.md 7.9). */
export function datosFiscalesIncompletos(cliente: ClienteOpcion): string[] {
  const faltan: string[] = [];
  if (!cliente.cif) faltan.push("CIF");
  if (!cliente.direccion) faltan.push("dirección");
  if (!cliente.telefono && !cliente.email) faltan.push("teléfono o email");
  return faltan;
}

export function SelectorCliente({
  clientes,
  clienteId,
  onSeleccionar,
  disabled = false,
}: SelectorClienteProps) {
  const [busqueda, setBusqueda] = useState("");
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return clientes;
    return clientes.filter(
      (cliente) =>
        cliente.nombre.toLowerCase().includes(termino) ||
        (cliente.cif ?? "").toLowerCase().includes(termino) ||
        (cliente.localidad ?? "").toLowerCase().includes(termino),
    );
  }, [busqueda, clientes]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar cliente por nombre, CIF o localidad…"
            aria-label="Buscar cliente"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialogoAbierto(true)}
          disabled={disabled}
        >
          <UserPlus className="h-4 w-4" />
          Cliente nuevo
        </Button>
      </div>

      <ul
        className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border"
        role="listbox"
        aria-label="Clientes"
      >
        {filtrados.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No hay clientes que coincidan. Puedes darlo de alta con “Cliente
            nuevo”.
          </li>
        )}
        {filtrados.map((cliente) => {
          const seleccionado = cliente.id === clienteId;
          return (
            <li key={cliente.id}>
              <button
                type="button"
                role="option"
                aria-selected={seleccionado}
                disabled={disabled}
                onClick={() => onSeleccionar(cliente)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors",
                  seleccionado
                    ? "bg-ancora-primary-light"
                    : "hover:bg-accent/60",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {cliente.nombre}
                    </span>
                    {seleccionado && (
                      <Check className="h-4 w-4 shrink-0 text-ancora-primary" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {cliente.cif ?? "Sin CIF"}
                    {cliente.localidad ? ` · ${cliente.localidad}` : ""}
                  </span>
                </span>
                <TipoClienteBadge tipo={cliente.tipo_cliente} />
              </button>
            </li>
          );
        })}
      </ul>

      <DialogClienteRapido
        abierto={dialogoAbierto}
        onCerrar={() => setDialogoAbierto(false)}
        onCreado={(cliente) => {
          setDialogoAbierto(false);
          setBusqueda("");
          onSeleccionar(cliente);
        }}
      />
    </div>
  );
}

function DialogClienteRapido({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (cliente: ClienteOpcion) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [cif, setCif] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    const resultado = await crearClienteRapido({
      nombre,
      cif: cif || null,
      telefono: telefono || null,
    });
    setGuardando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    onCreado({
      id: resultado.datos.cliente_id,
      nombre: resultado.datos.nombre,
      cif: cif || null,
      localidad: null,
      telefono: telefono || null,
      email: null,
      direccion: null,
      tipo_cliente: "esporadico",
      descuento_bordado_pct: 0,
    });
    setNombre("");
    setCif("");
    setTelefono("");
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(valor) => {
        if (!valor) onCerrar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cliente nuevo</DialogTitle>
          <DialogDescription>
            Alta rápida para no cortar el presupuesto. El resto de datos se
            completan luego en la ficha del cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cliente-rapido-nombre">Nombre</Label>
            <Input
              id="cliente-rapido-nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              disabled={guardando}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cliente-rapido-cif">CIF</Label>
              <Input
                id="cliente-rapido-cif"
                value={cif}
                onChange={(evento) => setCif(evento.target.value)}
                placeholder="Vacío si es CONTADO"
                disabled={guardando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente-rapido-telefono">Teléfono</Label>
              <Input
                id="cliente-rapido-telefono"
                value={telefono}
                onChange={(evento) => setTelefono(evento.target.value)}
                disabled={guardando}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Crear y seleccionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
