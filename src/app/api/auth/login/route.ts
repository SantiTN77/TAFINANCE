import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { checkPinThrottle, createSessionToken, getMasterPin, recordPinResult } from "@/lib/auth/security";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
    const throttle = checkPinThrottle(ip);
    if (!throttle.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Reintenta en ${throttle.retryAfterSec}s` },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const { pin, remember } = body;
    const masterPin = getMasterPin().trim();

    if (!pin || !safeEqual(pin.toString().trim(), masterPin)) {
      recordPinResult(ip, false);
      return NextResponse.json({ success: false, error: "PIN de seguridad incorrecto" }, { status: 401 });
    }
    recordPinResult(ip, true);

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
