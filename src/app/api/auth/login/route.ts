import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getMasterPin } from "@/lib/auth/security";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, remember } = body;

    const masterPin = getMasterPin();

    if (!pin || pin.toString().trim() !== masterPin.trim()) {
      return NextResponse.json(
        { success: false, error: "PIN de seguridad incorrecto" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(remember ? 60 : 7);
    const maxAge = (remember ? 60 : 7) * 24 * 60 * 60;

    const response = NextResponse.json({
      success: true,
      message: "Acceso concedido a la bóveda TAFINANCE",
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
      { success: false, error: "Error validando credenciales" },
      { status: 500 }
    );
  }
}
