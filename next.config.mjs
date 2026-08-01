/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // @react-pdf/renderer es un paquete ESM con dependencias nativas de Node
    // (pdfkit, fuentes embebidas). Si el bundler de Next intenta empaquetarlo
    // dentro del build del servidor, las fuentes Helvetica no se resuelven en
    // tiempo de ejecución. Se deja como dependencia externa para que se cargue
    // con `require` desde node_modules.
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
