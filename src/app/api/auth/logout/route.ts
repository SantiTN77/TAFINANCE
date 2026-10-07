import { NextResponse } from "next/server";
import { createCookieClient } from "@/lib/auth/session";

export async function POST() {
  const client = await createCookieClient();
  // scope "local": cierra solo este dispositivo
  if (client) await client.auth.signOut({ scope: "local" });
  const response = NextResponse.json({ success: true, message: "Sesión cerrada" });
  response.cookies.delete("tafinance_session"); // cookie de la versión monousuario
  return response;
}
