import { NextRequest, NextResponse } from "next/server";
import { signPayload } from "@/lib/auth/security";
import { getSession, isOwner } from "@/lib/auth/session";

/**
 * Vincula una credencial biométrica a ESTE dispositivo. Solo el dueño (TAFINANCE_OWNER_EMAIL): la biometría abre su sesión, así que otro usuario no puede vincularla.
 * La clave pública viaja en una cookie firmada (HMAC) de 1 año, httpOnly.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.status !== "active") {
    return NextResponse.json({ success: false, error: "Sesión requerida" }, { status: 401 });
  }
  if (!isOwner(session)) {
    return NextResponse.json({ success: false, error: "Solo disponible para la cuenta del dueño" }, { status: 403 });
  }
  try {
    const { credentialId, publicKey, alg } = await req.json();
    if (typeof credentialId !== "string" || typeof publicKey !== "string" || ![-7, -257].includes(alg)) {
      return NextResponse.json({ success: false, error: "Credencial inválida" }, { status: 400 });
    }
    const res = NextResponse.json({ success: true });
    res.cookies.set(
      "tafinance_device",
      await signPayload({ cid: credentialId, pk: publicKey, alg }, 365 * 24 * 60 * 60 * 1000),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      }
    );
    return res;
  } catch {
    return NextResponse.json({ success: false, error: "Error registrando credencial" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.status !== "active") return NextResponse.json({ success: false }, { status: 401 });
  const res = NextResponse.json({ success: true });
  res.cookies.set("tafinance_device", "", { path: "/", maxAge: 0 });
  return res;
}
