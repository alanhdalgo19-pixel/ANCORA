// F2.4 — `registrarFotoPrenda`, el núcleo de `subirFotoPrenda` y
// `reemplazarFotoPrenda`, con un doble en memoria de la tabla y el bucket.

import { describe, expect, it } from "vitest";
import type { ColorGrupo } from "@/types/database";
import {
  ERROR_PERMISO_FOTOS,
  registrarFotoPrenda,
  type EntradaFotoPrenda,
  type FilaNuevaFoto,
  type PuertosFotoPrenda,
} from "./registrar";
import { dimensionesDeFoto, TAMANO_MAX_FOTO_BYTES } from "./validar";

/** PNG mínimo válido: firma + chunk IHDR con las dimensiones pedidas. */
function bytesPng(ancho = 800, alto = 1000): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, ancho);
  new DataView(bytes.buffer).setUint32(20, alto);
  return bytes;
}

/** WebP extendido (VP8X) mínimo con las dimensiones pedidas. */
function bytesWebp(ancho: number, alto: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(30);
  const ascii = (texto: string, desde: number) =>
    bytes.set(Array.from(texto, (c) => c.charCodeAt(0)), desde);
  ascii("RIFF", 0);
  ascii("WEBP", 8);
  ascii("VP8X", 12);
  const anchoMenos1 = ancho - 1;
  const altoMenos1 = alto - 1;
  bytes.set([anchoMenos1 & 0xff, (anchoMenos1 >> 8) & 0xff, (anchoMenos1 >> 16) & 0xff], 24);
  bytes.set([altoMenos1 & 0xff, (altoMenos1 >> 8) & 0xff, (altoMenos1 >> 16) & 0xff], 27);
  return bytes;
}

type FilaGuardada = FilaNuevaFoto & { id: string };

function puertosFalsos() {
  const filas: FilaGuardada[] = [];
  const archivos = new Map<string, Uint8Array>();
  let siguiente = 0;

  const puertos: PuertosFotoPrenda = {
    fotoPrincipal: async (prendaId, color) => {
      const fila = filas.find((f) => f.prenda_id === prendaId && f.color_grupo === color);
      return fila ? { id: fila.id, storage_path: fila.storage_path } : null;
    },
    rutaNueva: (prendaId, color, formato) => `${prendaId}/${color}-${++siguiente}.${formato}`,
    subirArchivo: async (ruta, contenido) => {
      archivos.set(ruta, contenido);
      return true;
    },
    eliminarArchivo: async (ruta) => archivos.delete(ruta),
    insertarFila: async (fila) => {
      const id = `foto-${filas.length + 1}`;
      filas.push({ ...fila, id });
      return id;
    },
    actualizarFila: async (id, cambios) => {
      const fila = filas.find((f) => f.id === id);
      if (!fila) return false;
      Object.assign(fila, cambios);
      return true;
    },
  };

  return { puertos, filas, archivos };
}

function entrada(
  archivo: File,
  cambios: Partial<EntradaFotoPrenda> = {},
): EntradaFotoPrenda {
  return {
    rol: "admin",
    usuarioId: "usuario-alan",
    prendaId: "polo-star",
    colorGrupo: "color" as ColorGrupo,
    archivo,
    modo: "subir",
    ...cambios,
  };
}

const PNG = () => new File([bytesPng()], "polo-azul.png", { type: "image/png" });

describe("subirFotoPrenda (registrarFotoPrenda)", () => {
  it("valida formato, tamaño y firma del contenido (magic number)", async () => {
    const { puertos, filas, archivos } = puertosFalsos();

    const svg = new File(["<svg></svg>"], "polo.svg", { type: "image/svg+xml" });
    const enorme = new File([new Uint8Array(TAMANO_MAX_FOTO_BYTES + 1)], "polo.png", {
      type: "image/png",
    });
    // Ejecutable renombrado: el MIME dice PNG, los bytes no.
    const disfrazado = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "polo.png", {
      type: "image/png",
    });
    // Un PNG renombrado a .webp tampoco cuela.
    const webpFalso = new File([bytesPng()], "polo.webp", { type: "image/webp" });

    for (const archivo of [svg, enorme, disfrazado, webpFalso]) {
      const resultado = await registrarFotoPrenda(puertos, entrada(archivo));
      expect(resultado.ok).toBe(false);
    }
    expect(filas).toHaveLength(0);
    expect(archivos.size).toBe(0);

    // Una foto válida sí entra, con sus dimensiones leídas de la cabecera.
    const ok = await registrarFotoPrenda(puertos, entrada(PNG()));
    expect(ok).toEqual({ ok: true, foto_id: "foto-1" });
    expect(filas[0]).toMatchObject({
      prenda_id: "polo-star",
      color_grupo: "color",
      formato: "png",
      ancho_px: 800,
      alto_px: 1000,
      es_principal: true,
      subido_por: "usuario-alan",
    });
  });

  it("un operador (o consulta) recibe error de permiso y no se toca nada", async () => {
    const { puertos, filas, archivos } = puertosFalsos();

    for (const rol of ["operador", "consulta", null] as const) {
      const resultado = await registrarFotoPrenda(puertos, entrada(PNG(), { rol }));
      expect(resultado).toEqual({ ok: false, error: ERROR_PERMISO_FOTOS });
    }
    expect(filas).toHaveLength(0);
    expect(archivos.size).toBe(0);
  });

  it("reemplazar actualiza la misma fila y retira el archivo anterior; subir encima se rechaza", async () => {
    const { puertos, filas, archivos } = puertosFalsos();
    await registrarFotoPrenda(puertos, entrada(PNG()));
    const rutaVieja = filas[0].storage_path;

    const repetida = await registrarFotoPrenda(puertos, entrada(PNG()));
    expect(repetida.ok).toBe(false);

    const webp = new File([bytesWebp(1200, 1500)], "polo-azul.webp", { type: "image/webp" });
    const reemplazo = await registrarFotoPrenda(puertos, entrada(webp, { modo: "reemplazar" }));

    expect(reemplazo).toEqual({ ok: true, foto_id: "foto-1" });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ formato: "webp", ancho_px: 1200, alto_px: 1500 });
    expect(archivos.has(rutaVieja)).toBe(false);
    expect(archivos.has(filas[0].storage_path)).toBe(true);

    // Reemplazar en un hueco vacío no tiene sentido.
    const vacio = await registrarFotoPrenda(
      puertos,
      entrada(PNG(), { modo: "reemplazar", colorGrupo: "oscuro" }),
    );
    expect(vacio.ok).toBe(false);
  });

  it("lee las dimensiones de los tres tipos de WebP", () => {
    expect(dimensionesDeFoto(bytesWebp(640, 480), "webp")).toEqual({ ancho: 640, alto: 480 });

    // VP8L (sin pérdida): 14 bits de ancho-1 y 14 de alto-1 tras la firma 0x2F.
    const vp8l = new Uint8Array(30);
    vp8l.set(Array.from("RIFF", (c) => c.charCodeAt(0)), 0);
    vp8l.set(Array.from("WEBPVP8L", (c) => c.charCodeAt(0)), 8);
    vp8l[20] = 0x2f;
    const bits = (300 - 1) | ((200 - 1) << 14);
    vp8l.set([bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff], 21);
    expect(dimensionesDeFoto(vp8l, "webp")).toEqual({ ancho: 300, alto: 200 });

    // VP8 (con pérdida): código de inicio 9D 01 2A y 14 bits por eje.
    const vp8 = new Uint8Array(30);
    vp8.set(Array.from("RIFF", (c) => c.charCodeAt(0)), 0);
    vp8.set(Array.from("WEBPVP8 ", (c) => c.charCodeAt(0)), 8);
    vp8.set([0x9d, 0x01, 0x2a, 1024 & 0xff, 1024 >> 8, 768 & 0xff, 768 >> 8], 23);
    expect(dimensionesDeFoto(vp8, "webp")).toEqual({ ancho: 1024, alto: 768 });
  });
});
