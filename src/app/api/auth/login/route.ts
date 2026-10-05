import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getMasterPin, isAuthConfigured } from "@/lib/auth/security";
import { clientIp, hitPinThrottle, resetPinThrottle } from "@/lib/auth/throttle";
import { createCookieClient } from "@/lib/auth/session";
import { mintOwnerSession } from "@/lib/auth/owner-session";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ success: false, error }, { status, headers });

/**
 * Dos formas de entrar:
 *  - { email, password }: Supabase Auth (cualquier usuario activo).
 *  - { pin }: desbloqueo rápido del dueño (TAFINANCE_PIN + TAFINANCE_OWNER_EMAIL).
 * Ambas pasan por el limitador persistente ANTES de comprobar la credencial.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const pin = typeof body.pin === "string" || typeof body.pin === "number" ? String(body.pin).trim() : "";
    const usingPassword = !!email && !!password;
    if (!usingPassword && !pin) return fail("Credenciales incompletas", 400);

    const ip = clientIp(req.headers);
    const subject = usingPassword ? email : undefined;
    const throttle = await hitPinThrottle(ip, subject);
    if (!throttle.allowed) {
      if ("unavailable" in throttle) return fail("Servicio de acceso no disponible", 503);
      return fail(`Demasiados intentos. Reintenta en ${throttle.retryAfterSec}s`, 429, {
        "Retry-After": String(throttle.retryAfterSec),
      });
    }

    if (usingPassword) {
      const client = await createCookieClient();
      if (!client) return fail("Autenticación no configurada en el servidor", 503);
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) return fail("Correo o contraseña incorrectos", 401);
      const { data: profile } = await client.from("profiles").select("status").eq("id", data.user.id).maybeSingle();
      if (profile?.status !== "active") {
        await client.auth.signOut();
        return fail(
          profile?.status === "disabled" ? "Cuenta deshabilitada" : "Cuenta pendiente de aprobación por un administrador",
          403
        );
      }
      await resetPinThrottle(ip, subject);
      return NextResponse.json({ success: true, message: "Acceso concedido" });
    }

    const masterPin = getMasterPin();
    if (!masterPin || !isAuthConfigured()) return fail("Desbloqueo por PIN no configurado", 503);
    if (!safeEqual(pin, masterPin)) return fail("PIN de seguridad incorrecto", 401);
    const minted = await mintOwnerSession();
    if (!minted.ok) return fail(minted.error, minted.status);
    await resetPinThrottle(ip);
    return NextResponse.json({ success: true, message: "Acceso concedido" });
  } catch {
    return fail("Error validando credenciales", 500);
  }
}
