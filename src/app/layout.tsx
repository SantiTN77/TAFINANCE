import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context/AppContext";

export const metadata: Metadata = {
  title: "TAFINANCE — Inteligencia Financiera Personal & Bóveda Privada",
  description: "Tu asistente personal de contabilidad, presupuestos y control financiero con Gemini 3.8 Flash, escaneo OCR de facturas, bolsillos inteligentes y protocolo MCP.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TAFINANCE",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#070A11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body className="min-h-screen bg-[#070A11] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
