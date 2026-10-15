// F2.4 — fotos reales de una prenda: una por grupo de color.
//
// Tres tarjetas independientes (blanco / color / oscuro). Con foto: miniatura
// + Reemplazar / Eliminar; sin foto: "+ Subir". Mientras falte una, el mockup
// del wizard pinta para ese color el rectángulo abstracto de F2.2.
//
// Solo admin: la protege `admin/prendas/layout.tsx` (LayoutSoloAdmin).

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DIMENSIONES_PRENDAS } from "@/lib/mockup/dimensiones-prendas";
import { resolverTipoPrenda } from "@/lib/mockup/snapshot";
import { formatTamanoArchivo } from "@/lib/format";
import type { ColorGrupo } from "@/types/database";
import { SubirFotoDialog } from "./SubirFotoDialog";

interface Props {
  params: { id: string };
}

const SLOTS: { color: ColorGrupo; etiqueta: string }[] = [
  { color: "blanco", etiqueta: "Blanco" },
  { color: "color", etiqueta: "Color" },
  { color: "oscuro", etiqueta: "Oscuro" },
];

interface FotoFila {
  id: string;
  color_grupo: ColorGrupo;
  formato: string;
  tamano_bytes: number;
  ancho_px: number | null;
  alto_px: number | null;
  subido_at: string;
}

export default async function FotosPrendaPage({ params }: Props) {
  const supabase = createClient();
  const [{ data: prenda }, { data: fotos, error: errorFotos }] = await Promise.all([
    supabase
      .from("prendas")
      .select("id, nombre, codigo_interno, tipo_mockup, disponible_oscuro")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("prendas_fotos")
      .select("id, color_grupo, formato, tamano_bytes, ancho_px, alto_px, subido_at")
      .eq("prenda_id", params.id)
      .eq("es_principal", true),
  ]);

  if (!prenda) notFound();

  const porColor = new Map<ColorGrupo, FotoFila>();
  for (const foto of (fotos ?? []) as FotoFila[]) {
    porColor.set(foto.color_grupo, foto);
  }

  const tipo = resolverTipoPrenda(prenda.tipo_mockup as string | null);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <Link
          href={`/admin/prendas/${prenda.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a la ficha de prenda
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Fotos de {prenda.nombre as string}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tipo de mockup: {DIMENSIONES_PRENDAS[tipo].nombre_visible}. El logo se
          coloca automáticamente según el tipo; la foto debe mostrar la prenda
          de frente, centrada y sobre fondo claro.
        </p>
      </div>

      {errorFotos && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          No se han podido leer las fotos. ¿Está aplicada la migración
          20261015000000_prendas_fotos.sql?
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {SLOTS.map(({ color, etiqueta }) => {
          const foto = porColor.get(color) ?? null;
          return (
            <section
              key={color}
              aria-labelledby={`foto-${color}`}
              className="flex flex-col gap-3 rounded-lg border border-border p-4"
            >
              <h2 id={`foto-${color}`} className="text-sm font-semibold text-foreground">
                {etiqueta}
                {color === "oscuro" && prenda.disponible_oscuro === false && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (prenda no disponible en oscuro)
                  </span>
                )}
              </h2>

              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- redirect a URL firmada; next/image no aplica
                  <img
                    // `v` cambia al reemplazar: el id se conserva y sin él el
                    // navegador podría enseñar la miniatura anterior.
                    src={`/api/prendas-fotos/${foto.id}?v=${encodeURIComponent(foto.subido_at)}`}
                    alt={`${prenda.nombre as string} en ${etiqueta.toLowerCase()}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Sin foto</span>
                )}
              </div>

              {foto && (
                <p className="text-xs text-muted-foreground">
                  {foto.formato.toUpperCase()} · {formatTamanoArchivo(foto.tamano_bytes)}
                  {foto.ancho_px && foto.alto_px
                    ? ` · ${foto.ancho_px} × ${foto.alto_px} px`
                    : ""}
                </p>
              )}
              {foto?.formato === "webp" && (
                <p className="text-xs text-warning">
                  El PDF no admite WebP: en el PDF esta prenda saldrá genérica.
                  Sube PNG o JPG para que también salga la foto.
                </p>
              )}

              <SubirFotoDialog
                prendaId={prenda.id as string}
                colorGrupo={color}
                etiquetaColor={etiqueta}
                fotoId={foto?.id ?? null}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}
