// F2.4 — `resolverFotoPrenda` con un doble en memoria de la tabla y el bucket.

import { describe, expect, it } from "vitest";
import {
  resolverFotoPrenda,
  type FotoAlmacenada,
  type PuertosResolverFoto,
} from "./resolver-foto";

const FOTOS: (FotoAlmacenada & { prenda_id: string; color: string })[] = [
  {
    id: "foto-1",
    prenda_id: "polo-star",
    color: "color",
    storage_path: "polo-star/color-1.jpg",
    formato: "jpg",
    ancho_px: 800,
    alto_px: 1000,
  },
  {
    id: "foto-2",
    prenda_id: "polo-star",
    color: "blanco",
    storage_path: "polo-star/blanco-2.png",
    formato: "png",
    ancho_px: 900,
    alto_px: 900,
  },
];

function puertos(firmar = true): PuertosResolverFoto {
  return {
    buscarFoto: async (prendaId, color) =>
      FOTOS.find((foto) => foto.prenda_id === prendaId && foto.color === color) ?? null,
    firmarUrl: async (ruta) => (firmar ? `https://cdn.supabase/firmada/${ruta}` : null),
  };
}

describe("resolverFotoPrenda", () => {
  it("devuelve la foto de esa prenda y ese color, con URL firmada", async () => {
    await expect(resolverFotoPrenda("polo-star", "color", puertos())).resolves.toEqual({
      url: "https://cdn.supabase/firmada/polo-star/color-1.jpg",
      formato: "jpg",
      ancho_px: 800,
      alto_px: 1000,
    });
    const blanco = await resolverFotoPrenda("polo-star", "blanco", puertos());
    expect(blanco?.url).toContain("blanco-2.png");
  });

  it("devuelve null si no hay foto para ese color o si el archivo no se puede firmar", async () => {
    await expect(resolverFotoPrenda("polo-star", "oscuro", puertos())).resolves.toBeNull();
    await expect(resolverFotoPrenda("otra-prenda", "color", puertos())).resolves.toBeNull();
    await expect(resolverFotoPrenda("polo-star", "color", puertos(false))).resolves.toBeNull();
  });
});
