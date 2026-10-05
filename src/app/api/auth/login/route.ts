import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createSessionToken, getMasterPin, isAuthConfigured } from "@/lib/auth/security";
import { clientIp, hitPinThrottle, resetPinThrottle } from "@/lib/auth/throttle";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  try {
    const masterPin = getMasterPin();
    if (!masterPin || !isAuthConfigured()) {
      console.error("[TAF][auth] TAFINANCE_PIN / TAFINANCE_SECRET no configurados: login deshabilitado");
      return NextResponse.json({ success: false, error: "Bóveda no configurada en el servidor" }, { status: 503 });
    }

    const ip = clientIp(req.headers);
    const throttle = await hitPinThrottle(ip);
    if (!throttle.allowed) {
      if ("unavailable" in throttle) {
        return NextResponse.json({ success: false, error: "Servicio de acceso no disponible" }, { status: 503 });
      }
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Reintenta en ${throttle.retryAfterSec}s` },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const { pin, remember } = body;

    if (!pin || !safeEqual(pin.toString().trim(), masterPin)) {
      return NextResponse.json({ success: false, error: "PIN de seguridad incorrecto" }, { status: 401 });
    }
    await resetPinThrottle(ip);

    const token = await createSessionToken(remember ? 60 : 7);
    const maxAge = (remember ? 60 : 7) * 24 * 60 * 60;

    const response = NextResponse.json({ success: true, message: "Acceso concedido" });
    response.cookies.set("tafinance_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Error validando credenciales" }, { status: 500 });
  }
}
