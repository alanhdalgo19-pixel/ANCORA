"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface EnlaceAdmin {
  href: string;
  etiqueta: string;
}

interface GrupoAdmin {
  titulo: string;
  enlaces: EnlaceAdmin[];
}

const SECCIONES: GrupoAdmin[] = [
  { titulo: "", enlaces: [{ href: "/admin", etiqueta: "Resumen" }] },
  { titulo: "", enlaces: [{ href: "/admin/prendas", etiqueta: "Prendas" }] },
  {
    titulo: "Tarifas",
    enlaces: [
      { href: "/admin/tarifas/dtf", etiqueta: "DTF" },
      { href: "/admin/tarifas/bordado", etiqueta: "Bordado" },
      { href: "/admin/tarifas/serigrafia", etiqueta: "Serigrafía" },
      { href: "/admin/tarifas/impresion-directa", etiqueta: "Impresión directa" },
      { href: "/admin/tarifas/sublimacion", etiqueta: "Sublimación" },
      { href: "/admin/tarifas/picaje", etiqueta: "Picaje" },
    ],
  },
  { titulo: "", enlaces: [{ href: "/admin/margenes", etiqueta: "Márgenes" }] },
  { titulo: "", enlaces: [{ href: "/admin/costes", etiqueta: "Costes operativos" }] },
  { titulo: "", enlaces: [{ href: "/admin/proveedores", etiqueta: "Proveedores" }] },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border p-4">
      <nav className="space-y-5">
        {SECCIONES.map((grupo, indice) => (
          <div key={indice}>
            {grupo.titulo && (
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {grupo.titulo}
              </p>
            )}
            <div className="space-y-0.5">
              {grupo.enlaces.map((enlace) => {
                const activo =
                  enlace.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === enlace.href || pathname?.startsWith(`${enlace.href}/`);

                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                      activo
                        ? "bg-ancora-primary-light text-ancora-primary-dark"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {enlace.etiqueta}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
