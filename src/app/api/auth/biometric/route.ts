import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth/security";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credentialId } = body;

    if (!credentialId || typeof credentialId !== "string") {
      return NextResponse.json(
        { success: false, error: "Identificador biométrico inválido" },
        { status: 400 }
      );
    }

    // Issue session token for 60 days for authorized biometric device
    const token = await createSessionToken(60);
    const maxAge = 60 * 24 * 60 * 60;

    const response = NextResponse.json({
      success: true,
      message: "Autenticación biométrica exitosa. Acceso concedido.",
    });

    response.cookies.set("tafinance_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error en validación biométrica" },
      { status: 500 }
    );
  }
}
