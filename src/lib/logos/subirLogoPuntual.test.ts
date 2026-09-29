// F2.3 — subida puntual de un logo desde el paso 4 del wizard.
//
// `subirLogoPuntual` (Server Action) solo añade la autorización y deduce el
// cliente del presupuesto; todo lo demás es `registrarLogo` en modo "puntual",
// que es lo que se prueba aquí con un doble en memoria de Supabase + Storage.
// El modo "biblioteca" (F2.1) usa exactamente el mismo camino, así que estos
// tests también garantizan que la extracción no cambió su comportamiento.

import { describe, expect, it } from "vitest";
import {
  decidirPrincipal,
  registrarLogo,
  type EntradaRegistroLogo,
  type FilaNuevoLogo,
  type PuertosRegistroLogo,
} from "./registrar";
import { TAMANO_MAX_BYTES } from "./validar";

/** PNG mínimo válido: firma + chunk IHDR con las dimensiones pedidas. */
function bytesPng(ancho = 526, alto = 350): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, ancho);
  new DataView(bytes.buffer).setUint32(20, alto);
  return bytes;
}

/** Doble de la tabla y el bucket: guarda en memoria lo que se escribe. */
function puertosFalsos(logosPrevios = 0) {
  const filas: (FilaNuevoLogo & { id: string })[] = [];
  const archivos = new Map<string, Uint8Array>();
  let desmarcados = 0;

  const puertos: PuertosRegistroLogo = {
    contarLogos: async () => logosPrevios + filas.length,
    rutaNueva: (clienteId, formato) => `${clienteId}/nuevo-${filas.length}.${formato}`,
    subirArchivo: async (ruta, contenido) => {
      archivos.set(ruta, contenido);
      return { ok: true, ruta };
    },
    eliminarArchivo: async (ruta) => archivos.delete(ruta),
    desmarcarPrincipal: async () => {
      desmarcados += 1;
      return true;
    },
    insertarFila: async (fila) => {
      const id = `logo-${filas.length + 1}`;
      filas.push({ ...fila, id });
      return id;
    },
  };

  return { puertos, filas, archivos, desmarcados: () => desmarcados };
}

function entrada(
  archivo: File,
  cambios: Partial<EntradaRegistroLogo> = {},
): EntradaRegistroLogo {
  return {
    modo: "puntual",
    clienteId: "cliente-doyle",
    usuarioId: "usuario-sonia",
    archivo,
    nombre: "",
    notas: null,
    esPrincipalSolicitado: false,
    ...cambios,
  };
}

const PNG = () => new File([bytesPng()], "doyle_verano.png", { type: "image/png" });

describe("subirLogoPuntual (registrarLogo en modo puntual)", () => {
  it("valida formato, tamaño y firma igual que la biblioteca de F2.1", async () => {
    const { puertos, filas, archivos } = puertosFalsos();

    const gif = new File([new Uint8Array(100)], "logo.gif", { type: "image/gif" });
    const enorme = new File([new Uint8Array(TAMANO_MAX_BYTES + 1)], "logo.png", {
      type: "image/png",
    });
    // Ejecutable renombrado: el MIME dice PNG, los bytes no.
    const disfrazado = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "logo.png", {
      type: "image/png",
    });

    for (const archivo of [gif, enorme, disfrazado]) {
      const resultado = await registrarLogo(puertos, entrada(archivo));
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.error.length).toBeGreaterThan(0);
    }

    // Nada ha llegado ni al bucket ni a la tabla.
    expect(filas).toHaveLength(0);
    expect(archivos.size).toBe(0);
  });

  it("NO marca el logo como principal, ni siquiera si es el primero del cliente", async () => {
    const { puertos, filas, desmarcados } = puertosFalsos(0);

    const resultado = await registrarLogo(
      puertos,
      // Aunque alguien forzara el campo, el modo puntual lo ignora.
      entrada(PNG(), { esPrincipalSolicitado: true }),
    );

    expect(resultado.ok).toBe(true);
    expect(filas[0].es_principal).toBe(false);
    expect(desmarcados()).toBe(0);

    // Contraste con la biblioteca de F2.1: el primer logo sí sale principal.
    expect(decidirPrincipal("biblioteca", false, 0)).toBe(true);
    expect(decidirPrincipal("puntual", true, 0)).toBe(false);
  });

  it("devuelve el logo_id de la fila creada, con nombre, formato y dimensiones", async () => {
    const { puertos, filas, archivos } = puertosFalsos(2);

    const resultado = await registrarLogo(puertos, entrada(PNG()));

    expect(resultado).toEqual({
      ok: true,
      logo_id: "logo-1",
      nombre: "doyle_verano.png",
      formato: "png",
      es_principal: false,
    });
    expect(filas[0]).toMatchObject({
      id: "logo-1",
      cliente_id: "cliente-doyle",
      subido_por: "usuario-sonia",
      formato: "png",
      ancho_px: 526,
      alto_px: 350,
    });
    expect(archivos.has(filas[0].storage_path)).toBe(true);
  });

  it("si falla la fila, retira el archivo del bucket para no dejar huérfanos", async () => {
    const { puertos, archivos } = puertosFalsos();
    puertos.insertarFila = async () => null;

    const resultado = await registrarLogo(puertos, entrada(PNG()));

    expect(resultado.ok).toBe(false);
    expect(archivos.size).toBe(0);
  });
});
