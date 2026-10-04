import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifyPayload } from "@/lib/auth/security";
import { DeviceCredential, requestOrigin, verifyAssertion } from "@/lib/auth/webauthn-server";

/**
 * Valida una aserción WebAuthn real (firma + desafío + origen + verificación de usuario)
 * contra la credencial ligada a este dispositivo. Solo entonces emite la sesión.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credentialId, authenticatorData, clientDataJSON, signature } = body;
    if (![credentialId, authenticatorData, clientDataJSON, signature].every((v) => typeof v === "string" && v)) {
      return NextResponse.json({ success: false, error: "Aserción biométrica incompleta" }, { status: 400 });
    }

    const device = await verifyPayload<DeviceCredential>(req.cookies.get("tafinance_device")?.value);
    const chal = await verifyPayload<{ c: string }>(req.cookies.get("tafinance_chal")?.value);
    if (!device || device.cid !== credentialId) {
      return NextResponse.json({ success: false, error: "Dispositivo no vinculado" }, { status: 401 });
    }
    if (!chal) {
      return NextResponse.json({ success: false, error: "Desafío vencido, intenta de nuevo" }, { status: 401 });
    }

    const { origin, rpId } = requestOrigin(req);
    const result = await verifyAssertion({
      credential: device,
      expectedChallenge: chal.c,
      expectedOrigin: origin,
      expectedRpId: rpId,
      authenticatorData,
      clientDataJSON,
      signature,
    });
    if (!result.ok) {
      console.warn("[TAF][auth/biometric] rechazada:", result.reason);
      return NextResponse.json({ success: false, error: "Verificación biométrica fallida" }, { status: 401 });
    }

    const token = await createSessionToken(60);
    const response = NextResponse.json({ success: true, message: "Acceso concedido" });
    response.cookies.set("tafinance_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 24 * 60 * 60,
      path: "/",
    });
    response.cookies.set("tafinance_chal", "", { path: "/api/auth/biometric", maxAge: 0 }); // un solo uso
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Error en validación biométrica" }, { status: 500 });
  }
}
