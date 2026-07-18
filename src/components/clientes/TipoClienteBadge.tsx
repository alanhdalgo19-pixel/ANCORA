import { Badge } from "@/components/ui/badge";
import type { TipoCliente } from "@/types/database";

export function TipoClienteBadge({ tipo }: { tipo: TipoCliente }) {
  if (tipo === "habitual") {
    return <Badge>Cliente habitual</Badge>;
  }
  return <Badge variant="secondary">Cliente esporádico</Badge>;
}
