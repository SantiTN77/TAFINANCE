import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { base64UrlEncode, signPayload, verifyPayload } from "@/lib/auth/security";
import type { DeviceCredential } from "@/lib/auth/webauthn-server";

/** Entrega un desafío de un solo uso y el id de la credencial vinculada a este dispositivo. */
export async function GET(req: NextRequest) {
  const device = await verifyPayload<DeviceCredential>(req.cookies.get("tafinance_device")?.value);
  if (!device) {
    return NextResponse.json(
      { error: "Este dispositivo no tiene huella vinculada. Entra con tu PIN y actívala en Ajustes." },
      { status: 404 }
    );
  }
  const challenge = base64UrlEncode(randomBytes(32));
  const res = NextResponse.json({ challenge, credentialId: device.cid });
  res.cookies.set("tafinance_chal", await signPayload({ c: challenge }, 2 * 60 * 1000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 120,
    path: "/api/auth/biometric",
  });
  return res;
}
