import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/context/AppContext";
import { PwaProvider } from "@/lib/pwa/PwaProvider";
import { DebugConsole } from "@/components/debug/DebugConsole";

export const metadata: Metadata = {
  title: "TAFINANCE — Finanzas personales con voz e IA",
  description:
    "Registra gastos con tu voz, escanea facturas, organiza bolsillos y recibe avisos de pago. Una app de finanzas personales privada y rápida.",
  manifest: "/manifest.json",
  applicationName: "TAFINANCE",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TAFINANCE",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#070A11" },
  ],
};

// Aplica el tema guardado antes de pintar (evita el parpadeo oscuro → claro)
const THEME_INIT = `(function(){try{var t=localStorage.getItem('tafinance_theme')||'dark';var r=document.documentElement;r.classList.remove('dark','light','oled');if(t==='light'){r.classList.add('light')}else if(t==='oled'){r.classList.add('dark','oled')}else{r.classList.add('dark')}var l=localStorage.getItem('tafinance_lang');if(l)r.lang=l;var m=document.querySelector('meta[name="theme-color"]');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-app text-white selection:bg-emerald-500/30">
        <AppProvider>
          <PwaProvider>
            {children}
            <DebugConsole />
          </PwaProvider>
        </AppProvider>
      </body>
    </html>
  );
}
