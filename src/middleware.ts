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
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow static Next.js assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    // Check if it's explicitly one of the public static assets or Next internals
    const isPublicStatic =
      pathname.startsWith("/_next") ||
      PUBLIC_PATHS.some((p) => pathname === p || pathname.endsWith(".svg") || pathname.endsWith(".png"));
    if (isPublicStatic) {
      return NextResponse.next();
    }
  }

  // 2. Allow explicit public endpoints
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 3. Check session cookie
  const token = req.cookies.get("tafinance_session")?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (isAuthenticated) {
    // If user is already authenticated and visits /lock, redirect to home
    if (pathname === "/lock") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 4. Unauthorized handling
  // If it's an API request, return 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Acceso denegado. La bóveda TAFINANCE está bloqueada.",
      },
      { status: 401 }
    );
  }

  // If it's a page request, redirect to /lock
  const lockUrl = new URL("/lock", req.url);
  if (pathname !== "/") {
    lockUrl.searchParams.set("redirect", pathname);
  }
  return NextResponse.redirect(lockUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
