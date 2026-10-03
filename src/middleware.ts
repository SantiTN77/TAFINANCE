import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth/security";

// Public static files and public routes allowed without authentication
const PUBLIC_PATHS = [
  "/lock",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
  "/favicon.ico",
  "/api/auth/login",
  "/api/auth/biometric",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. IP Whitelisting Layer (Optional Vercel config: ALLOWED_IPS=181.53.99.92,...)
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

  // 2. Allow static Next.js assets & public icons
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
          pathname.endsWith(".json")
      );
    if (isPublicStatic) {
      return NextResponse.next();
    }
  }

  // 3. Allow explicit public endpoints
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 4. Check session cookie
  const token = req.cookies.get("tafinance_session")?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (isAuthenticated) {
    // If user is already authenticated and visits /lock, redirect to dashboard
    if (pathname === "/lock") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 5. Unauthorized handling
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

  // For pages, redirect to /lock
  const lockUrl = new URL("/lock", req.url);
  if (pathname !== "/") {
    lockUrl.searchParams.set("redirect", pathname);
  }
  return NextResponse.redirect(lockUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
