import Link from "next/link";

const TECNICAS = [
  { href: "/admin/tarifas/dtf", etiqueta: "DTF" },
  { href: "/admin/tarifas/bordado", etiqueta: "Bordado" },
  { href: "/admin/tarifas/serigrafia", etiqueta: "Serigrafía" },
  { href: "/admin/tarifas/impresion-directa", etiqueta: "Impresión directa" },
  { href: "/admin/tarifas/sublimacion", etiqueta: "Sublimación" },
  { href: "/admin/tarifas/picaje", etiqueta: "Picaje" },
];

export default function AdminTarifasPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Tarifas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elige una técnica para configurar su tarifa.
      </p>

      <div className="mt-6 grid max-w-md grid-cols-1 gap-2">
        {TECNICAS.map((tecnica) => (
          <Link
            key={tecnica.href}
            href={tecnica.href}
            className="rounded-lg border border-border p-3 text-sm font-medium text-foreground hover:bg-accent"
          >
            {tecnica.etiqueta}
          </Link>
        ))}
      </div>
    </main>
  );
}
