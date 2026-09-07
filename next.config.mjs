/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @react-pdf/renderer es un paquete ESM con dependencias nativas de Node
    // (pdfkit, fuentes embebidas). Si el bundler de Next intenta empaquetarlo
    // dentro del build del servidor, las fuentes Helvetica no se resuelven en
    // tiempo de ejecución. Se deja como dependencia externa para que se cargue
    // con `require` desde node_modules.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],

    // El logo del PDF se lee del sistema de archivos con `fs.readFileSync`
    // (ver `src/lib/pdf/logo.tsx`). En Vercel los assets de `public/` se sirven
    // desde el CDN y no están en el sistema de archivos de la función, así que
    // hay que incluirlo explícitamente. El PDF se genera desde dos sitios (el
    // route handler de descarga y la Server Action que archiva al emitir), así
    // que se incluye en todas las rutas: son 15 KB, no compensa afinar más.
    outputFileTracingIncludes: {
      "/**": ["./public/logo-ancora.png"],
    },

    // La subida de logos (F2.1) viaja por una Server Action y el tope de
    // archivo son 5 MB (`TAMANO_MAX_BYTES`). El límite por defecto de Next
    // para el cuerpo de una Server Action es 1 MB, así que un logo grande
    // fallaría con un error genérico antes de llegar a nuestra validación.
    // 6 MB deja margen para el resto de campos del formulario.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
