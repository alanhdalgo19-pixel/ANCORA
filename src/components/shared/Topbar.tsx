"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/supabase/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Rol } from "@/types/database";

interface TopbarProps {
  nombre: string;
  rol: Rol;
}

/**
 * Enlace de la navegación principal con estado activo (CLAUDE.md 13.8 punto 2).
 *
 * Se considera activo cuando la ruta actual *empieza por* `href`, de modo que
 * la ficha de un presupuesto (`/presupuestos/[id]`) o una subpágina del panel
 * (`/admin/tarifas/dtf`) sigan resaltando su pestaña.
 */
function EnlaceNav({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();
  const activo = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        // El borde inferior se compensa con padding para que el texto no salte
        // entre el estado activo y el inactivo.
        "border-b-2 py-[18px] text-sm font-medium transition-colors",
        activo
          ? "border-ancora-primary text-ancora-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

export function Topbar({ nombre, rol }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex h-full items-center gap-6">
        <Link href="/" className="flex items-center" aria-label="Áncora — inicio">
          <Image
            src="/logo-ancora.png"
            alt="Ancora Publicitat"
            width={569}
            height={158}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <nav className="flex h-full items-center gap-4">
          <EnlaceNav href="/presupuestos">Presupuestos</EnlaceNav>
          <EnlaceNav href="/clientes">Clientes</EnlaceNav>
          {rol === "admin" && <EnlaceNav href="/admin">Admin</EnlaceNav>}
        </nav>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-accent">
          {nombre}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <form action={signOut} className="w-full">
              <button
                type="submit"
                className="flex w-full items-center gap-2 text-left"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
