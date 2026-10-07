import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Public static files and public routes allowed without authentication
const PUBLIC_PATHS = [
  "/lock",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
  "/favicon.ico",
  "/sw.js",
  "/offline.html",
  "/api/push/cron", // autenticado con CRON_SECRET en la propia ruta
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/biometric",
  "/api/auth/check",
  "/api/mcp",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow MCP endpoints for Google Spark and remote agent integrations (Public & CORS friendly)
  if (pathname.startsWith("/api/mcp")) {
    return NextResponse.next();
  }

  // 1b. Digital Asset Links must stay reachable for Google's verifier (bypasses IP whitelist)
  if (pathname === "/.well-known/assetlinks.json") {
    return NextResponse.next();
  }

  // 2. IP Whitelisting Layer (Optional Vercel config: ALLOWED_IPS=181.53.99.92,...)
  const allowedIpsEnv = process.env.ALLOWED_IPS;
  if (allowedIpsEnv && allowedIpsEnv.trim() !== "") {
    const allowedIps = allowedIpsEnv
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "";

    // If IP whitelist is active and current client IP doesn't match
    if (clientIp && !allowedIps.includes(clientIp)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Acceso denegado: tu IP no se encuentra autorizada en esta bóveda privada.",
          clientIp,
        },
        { status: 403 }
      );
    }
  }

  // 3. Allow static Next.js assets & public icons
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    const isPublicStatic =
      pathname.startsWith("/_next") ||
      PUBLIC_PATHS.some(
        (p) =>
          pathname === p ||
          pathname.endsWith(".svg") ||
          pathname.endsWith(".png") ||
          pathname.endsWith(".ico") ||
          pathname.endsWith(".json") ||
          pathname.endsWith(".webmanifest")
      );
    if (isPublicStatic) {
      return NextResponse.next();
    }
  }

  // 4. Allow public landing page directly
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 5. Allow explicit public endpoints (exact match or path starting with prefix + '/')
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  // 6. Sesión de Supabase Auth. getUser() valida el JWT contra Auth y, si caducó, lo refresca
  //    (las cookies renovadas se copian a la respuesta). Sin configuración → falla cerrado.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let refreshed: { name: string; value: string; options?: any }[] = [];
  let isAuthenticated = false;
  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          refreshed = list;
          list.forEach(({ name, value }) => req.cookies.set(name, value));
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    isAuthenticated = !error && !!data.user;
  }
  const withCookies = (res: NextResponse) => {
    refreshed.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };

  if (isAuthenticated) {
    // Con sesión, /lock no tiene sentido: directo a la app
    if (pathname === "/lock") {
      return withCookies(NextResponse.redirect(new URL("/app", req.url)));
    }
    return withCookies(NextResponse.next({ request: req }));
  }

  // 7. Unauthorized handling
  // For API endpoints, return 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Acceso denegado. La bóveda TAFINANCE está bloqueada.",
      },
      { status: 401 }
    );
  }

  // For protected routes like /app, redirect to /lock
  const lockUrl = new URL("/lock", req.url);
  if (pathname !== "/app") {
    lockUrl.searchParams.set("redirect", pathname);
  }
  return NextResponse.redirect(lockUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
