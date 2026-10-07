import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/session";
import { MIN_PASSWORD } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

/** Cambia la contraseña del usuario con sesión (la contraseña nueva no pasa por terceros). */
export async function POST(req: NextRequest) {
  const guard = await requireActiveUser();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }
  const { error } = await guard.session.db.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
