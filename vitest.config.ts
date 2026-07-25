import path from "node:path";
import { defineConfig } from "vitest/config";

// Configuración de tests del motor de cálculo (CLAUDE.md sección 7).
// Entorno `node`: las funciones de `src/lib/calculos/` son puras y no tocan
// el DOM, Supabase ni Next.js, así que no hace falta JSDOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
