import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Áncora — Presupuestos",
  description: "Gestión de presupuestos de Ancora Publicitat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
