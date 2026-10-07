import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * El servidor MCP puede leer y escribir tus finanzas, así que exige un token:
 *   Authorization: Bearer <MCP_TOKEN>   (o ?token=<MCP_TOKEN> para clientes que no envían cabeceras)
 * Sin MCP_TOKEN configurado el endpoint queda deshabilitado.
 */
export function checkMcpAuth(req: NextRequest, headers: Record<string, string> = {}): NextResponse | null {
  const expected = process.env.MCP_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "MCP deshabilitado: define MCP_TOKEN en el servidor para activarlo." },
      { status: 503, headers }
    );
  }
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("token") || "";
  if (!bearer || !safeEqual(bearer, expected)) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } }
    );
  }
  return null;
}
