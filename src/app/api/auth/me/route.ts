import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Identidad del usuario de la sesión (el navegador la usa para no mezclar cachés locales). */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json(
    { id: s.user.id, email: s.user.email, role: s.role, status: s.status },
    { headers: { "Cache-Control": "no-store" } }
  );
}
