import {
  EMPRESA,
  FORMA_PAGO_RESUMEN,
  NOTAS_ESTANDAR,
  datosEmpresaPendientes,
} from "@/lib/empresa";
import { formatEuros, formatFecha } from "@/lib/format";
import {
  subdescripcionLinea,
  subdescripcionPrenda,
} from "@/lib/presupuestos/descripciones";
import { TipoClienteBadge } from "@/components/clientes/TipoClienteBadge";
import { EstadoBadge } from "./EstadoBadge";
import type { Cliente, Presupuesto } from "@/types/database";
import type { LineaVista } from "@/types/presupuestos";

interface PresupuestoPreviewProps {
  presupuesto: Presupuesto;
  cliente: Cliente;
  nombreEmisor: string;
  lineas: LineaVista[];
}

function Dato({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-[#1a1a1a]">{children}</p>;
}

function ValorPendiente() {
  return <span className="text-[#b68900]">PENDIENTE</span>;
}

/**
 * Réplica en HTML del PDF de presupuesto (CLAUDE.md sección 7.9).
 *
 * Componente de presentación puro y sin estado: el Prompt 7 lo reutiliza como
 * referencia visual para el PDF real con @react-pdf/renderer. Por eso el
 * documento va con anchos y tipografías fijas (formato A4) en vez de un layout
 * responsivo: lo que se ve aquí es lo que debe salir impreso.
 */
export function PresupuestoPreview({
  presupuesto,
  cliente,
  nombreEmisor,
  lineas,
}: PresupuestoPreviewProps) {
  const pendientes = datosEmpresaPendientes();
  const descuentoImporte =
    (Number(presupuesto.subtotal) * Number(presupuesto.descuento_manual_pct)) /
    100;

  return (
    <div className="space-y-4">
      {pendientes.length > 0 && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Faltan datos de Ancora para el PDF definitivo: {pendientes.join(", ")}.
          Se completan en <code>src/lib/empresa.ts</code> cuando Espe los
          facilite.
        </p>
      )}

      <article
        aria-label="Vista previa del presupuesto"
        className="mx-auto w-full max-w-[820px] bg-white p-10 text-[#1a1a1a] shadow-sm ring-1 ring-[#e0e0e0]"
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        {/* Cabecera */}
        <header className="flex items-start justify-between gap-8 border-b border-[#e0e0e0] pb-6">
          {/* El logo oficial ya rotula "ANCORA PUBLICITAT": no se repite en texto. */}
          <div className="flex flex-col gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- réplica fiel
                del PDF: `next/image` envuelve el logo en su propio contenedor y
                descuadra la cabecera respecto al documento impreso. */}
            <img
              src="/logo-ancora.png"
              alt="Ancora Publicitat"
              className="h-11 w-auto"
            />
            <p className="text-xs text-[#5a5a5a]">
              {EMPRESA.localidad} · {EMPRESA.provincia}
            </p>
          </div>

          <div className="text-right">
            <h1 className="text-xl font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]">
              Presupuesto
            </h1>
            <p className="mt-1 text-sm font-medium text-[#0c8aa3]">
              {presupuesto.numero}
            </p>
            <p className="mt-2 text-xs text-[#5a5a5a]">
              Fecha de emisión: {formatFecha(presupuesto.fecha_emision)}
            </p>
            <p className="text-xs text-[#5a5a5a]">
              Válido hasta: {formatFecha(presupuesto.fecha_validez)}
            </p>
          </div>
        </header>

        {/* Badges y trazabilidad */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoBadge estado={presupuesto.estado} />
            <TipoClienteBadge tipo={cliente.tipo_cliente} />
            {!cliente.activo && (
              <span className="rounded-md border border-[#c62828]/30 bg-[#c62828]/10 px-2.5 py-0.5 text-xs font-semibold text-[#c62828]">
                Cliente inactivo
              </span>
            )}
          </div>
          <p className="text-xs text-[#8a8a8a]">Emite: {nombreEmisor}</p>
        </div>

        {/* DE / PARA */}
        <section className="grid grid-cols-2 gap-6 border-y border-[#e0e0e0] py-5">
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
              De
            </h2>
            <Dato>
              <strong>{EMPRESA.razon_social}</strong>
            </Dato>
            <Dato>NIF: {EMPRESA.nif}</Dato>
            <Dato>{EMPRESA.direccion ?? <ValorPendiente />}</Dato>
            <Dato>
              {EMPRESA.codigo_postal ?? <ValorPendiente />} {EMPRESA.localidad} (
              {EMPRESA.provincia})
            </Dato>
            <Dato>Tel.: {EMPRESA.telefono ?? <ValorPendiente />}</Dato>
            {/* El email es opcional: si no está, la línea no aparece. */}
            {EMPRESA.email && <Dato>Email: {EMPRESA.email}</Dato>}
          </div>

          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
              Para
            </h2>
            <Dato>
              <strong>{cliente.nombre}</strong>
            </Dato>
            <Dato>{cliente.cif ? `CIF: ${cliente.cif}` : "CONTADO"}</Dato>
            {cliente.direccion && <Dato>{cliente.direccion}</Dato>}
            {(cliente.codigo_postal || cliente.localidad) && (
              <Dato>
                {[cliente.codigo_postal, cliente.localidad]
                  .filter(Boolean)
                  .join(" ")}
                {cliente.provincia ? ` (${cliente.provincia})` : ""}
              </Dato>
            )}
            {cliente.telefono && <Dato>Tel.: {cliente.telefono}</Dato>}
            {cliente.email && <Dato>{cliente.email}</Dato>}
          </div>
        </section>

        {/* Comentario opcional */}
        {(cliente.persona_contacto || presupuesto.notas) && (
          <section className="border-b border-[#e0e0e0] py-4">
            {cliente.persona_contacto && (
              <p className="text-[13px] text-[#5a5a5a]">
                A la atención de <strong>{cliente.persona_contacto}</strong>
                {cliente.telefono ? ` · ${cliente.telefono}` : ""}
                {cliente.email ? ` · ${cliente.email}` : ""}
              </p>
            )}
            {presupuesto.notas && (
              <p className="mt-2 whitespace-pre-line text-[13px] text-[#5a5a5a]">
                {presupuesto.notas}
              </p>
            )}
          </section>
        )}

        {/* Tabla de líneas */}
        <section className="py-6">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#d4d4d4] text-left">
                <th className="pb-2 font-semibold text-[#5a5a5a]">Concepto</th>
                <th className="w-20 pb-2 text-right font-semibold text-[#5a5a5a]">
                  Cant.
                </th>
                <th className="w-28 pb-2 text-right font-semibold text-[#5a5a5a]">
                  Precio ud.
                </th>
                <th className="w-28 pb-2 text-right font-semibold text-[#5a5a5a]">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {lineas.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-[#8a8a8a]"
                  >
                    Sin líneas todavía.
                  </td>
                </tr>
              )}
              {lineas.map((linea) => {
                const detalle =
                  linea.tipo_linea === "prenda"
                    ? subdescripcionPrenda(linea.detalle_calculo)
                    : subdescripcionLinea(linea.detalle_calculo);
                const esExtra = linea.tipo_linea === "extra";

                return (
                  <tr key={linea.id} className="border-b border-[#f0f0f0]">
                    <td className="py-2.5 align-top">
                      <span
                        className={
                          esExtra ? "pl-4 text-[#5a5a5a]" : "text-[#1a1a1a]"
                        }
                      >
                        {esExtra ? `· ${linea.descripcion}` : linea.descripcion}
                      </span>
                      {detalle && (
                        <span className="mt-0.5 block text-[11px] text-[#8a8a8a]">
                          {detalle}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right align-top text-[#5a5a5a]">
                      {esExtra ? "" : linea.cantidad}
                    </td>
                    <td className="py-2.5 text-right align-top text-[#5a5a5a]">
                      {esExtra ? "" : formatEuros(linea.precio_unitario)}
                    </td>
                    <td className="py-2.5 text-right align-top text-[#1a1a1a]">
                      {formatEuros(linea.importe_linea)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Totales */}
        <section className="flex justify-end border-t border-[#e0e0e0] pt-4">
          <dl className="w-64 text-[13px]">
            <div className="flex justify-between py-1">
              <dt className="text-[#5a5a5a]">Subtotal líneas</dt>
              <dd>{formatEuros(presupuesto.subtotal)}</dd>
            </div>
            {Number(presupuesto.descuento_manual_pct) > 0 && (
              <div className="flex justify-between py-1">
                <dt className="text-[#5a5a5a]">
                  Descuento ({presupuesto.descuento_manual_pct}%)
                </dt>
                <dd>− {formatEuros(descuentoImporte)}</dd>
              </div>
            )}
            {/* El transporte va antes de la base imponible: forma parte de
                ella y tributa al mismo tipo (CLAUDE.md 13.6). */}
            {Number(presupuesto.transporte) > 0 && (
              <div className="flex justify-between py-1">
                <dt className="text-[#5a5a5a]">Transporte</dt>
                <dd>{formatEuros(presupuesto.transporte)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[#e0e0e0] py-1 pt-2">
              <dt className="text-[#5a5a5a]">Base imponible</dt>
              <dd>{formatEuros(presupuesto.base_imponible)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-[#5a5a5a]">IVA ({presupuesto.iva_pct}%)</dt>
              <dd>{formatEuros(presupuesto.iva_importe)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-[#d4d4d4] pt-2">
              <dt className="font-semibold text-[#1a1a1a]">TOTAL</dt>
              <dd className="text-base font-semibold text-[#0c8aa3]">
                {formatEuros(presupuesto.total)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Notas estándar */}
        <section className="mt-8 border-t border-[#e0e0e0] pt-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
            Condiciones
          </h2>
          <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-[#5a5a5a]">
            {NOTAS_ESTANDAR.map((nota) => (
              <li key={nota}>{nota}</li>
            ))}
          </ol>
        </section>

        {/* Forma de pago y firma */}
        <section className="mt-6 grid grid-cols-2 gap-6 border-t border-[#e0e0e0] pt-5">
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
              Forma de pago
            </h2>
            <p className="text-[12px] text-[#5a5a5a]">{FORMA_PAGO_RESUMEN}</p>
            <p className="mt-1 text-[12px] text-[#5a5a5a]">
              Transferencia{EMPRESA.banco ? ` (${EMPRESA.banco})` : ""} a IBAN:{" "}
              {EMPRESA.iban ?? <ValorPendiente />}
            </p>
            {cliente.condiciones_pago && (
              <p className="mt-1 text-[12px] text-[#5a5a5a]">
                Condiciones acordadas: {cliente.condiciones_pago}
              </p>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#8a8a8a]">
              Conforme, el cliente
            </h2>
            <div className="mt-10 border-t border-[#d4d4d4] pt-1">
              <p className="text-[11px] text-[#8a8a8a]">
                Firma y sello · {cliente.nombre}
              </p>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
