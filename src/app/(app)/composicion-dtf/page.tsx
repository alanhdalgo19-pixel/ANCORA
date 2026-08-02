import Link from "next/link";

/**
 * Página histórica del bootstrap: la composición DTF acabó integrada dentro
 * del wizard (Prompt 8), no como pantalla independiente. Se mantiene la ruta
 * para no romper enlaces guardados y se apunta al sitio correcto.
 */
export default function ComposicionDtfPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">
        Composición DTF
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        La composición de varios logos en el mismo rollo ya no es una pantalla
        aparte: se hace al añadir una línea de DTF a un presupuesto. En el paso
        de detalles, pulsa <strong>«+ Añadir logo»</strong> tantas veces como
        logos lleve el trabajo y el sistema los encajará en el menor número de
        metros posible.
      </p>
      <Link
        href="/presupuestos"
        className="mt-4 inline-block text-sm text-ancora-primary hover:underline"
      >
        Ir a presupuestos →
      </Link>
    </main>
  );
}
