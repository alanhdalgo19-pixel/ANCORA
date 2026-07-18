"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "@/lib/supabase/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  nombre: string;
}

export function Topbar({ nombre }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-2">
        <span
          className="h-8 w-8 rounded-full bg-ancora-primary"
          aria-hidden="true"
        />
        <span className="text-base font-semibold text-foreground">
          Áncora
        </span>
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
