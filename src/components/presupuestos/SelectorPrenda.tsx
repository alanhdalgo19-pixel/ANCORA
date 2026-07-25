"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PrendaOpcion {
  id: string;
  codigo_interno: string;
  nombre: string;
  proveedor_id: string;
  proveedor_nombre: string;
  disponible_oscuro: boolean;
}

interface SelectorPrendaProps {
  prendas: PrendaOpcion[];
  prendaId: string | null;
  onSeleccionar: (prenda: PrendaOpcion) => void;
  disabled?: boolean;
}

export function SelectorPrenda({
  prendas,
  prendaId,
  onSeleccionar,
  disabled = false,
}: SelectorPrendaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [proveedorId, setProveedorId] = useState("");

  // Objeto plano en vez de Map: el `target` de tsconfig no permite iterar
  // `Map.entries()` sin `downlevelIteration` (mismo caso que el Prompt 3).
  const proveedores = useMemo(() => {
    const porId: Record<string, string> = {};
    prendas.forEach((prenda) => {
      porId[prenda.proveedor_id] = prenda.proveedor_nombre;
    });
    return Object.entries(porId).sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [prendas]);

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return prendas.filter((prenda) => {
      if (proveedorId && prenda.proveedor_id !== proveedorId) return false;
      if (!termino) return true;
      return (
        prenda.nombre.toLowerCase().includes(termino) ||
        prenda.codigo_interno.toLowerCase().includes(termino)
      );
    });
  }, [busqueda, prendas, proveedorId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar prenda por nombre o código…"
            aria-label="Buscar prenda"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-proveedor" className="text-xs">
            Proveedor
          </Label>
          <select
            id="filtro-proveedor"
            value={proveedorId}
            onChange={(evento) => setProveedorId(evento.target.value)}
            disabled={disabled}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            <option value="">Todos</option>
            {proveedores.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul
        className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border"
        role="listbox"
        aria-label="Catálogo de prendas"
      >
        {filtradas.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No hay prendas que coincidan con el filtro.
          </li>
        )}
        {filtradas.map((prenda) => {
          const seleccionada = prenda.id === prendaId;
          return (
            <li key={prenda.id}>
              <button
                type="button"
                role="option"
                aria-selected={seleccionada}
                disabled={disabled}
                onClick={() => onSeleccionar(prenda)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors",
                  seleccionada ? "bg-ancora-primary-light" : "hover:bg-accent/60",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {prenda.nombre}
                    </span>
                    {seleccionada && (
                      <Check className="h-4 w-4 shrink-0 text-ancora-primary" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {prenda.codigo_interno} · {prenda.proveedor_nombre}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
