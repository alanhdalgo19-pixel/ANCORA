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
  // `tsconfig.json` deja el JSX en `preserve` para que lo transforme Next.
  // esbuild (el transformador de Vitest) no sabe qué hacer con eso, así que
  // aquí se le indica la transformación automática: la necesita el smoke test
  // del PDF, que importa el componente `PresupuestoPDF.tsx`.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
