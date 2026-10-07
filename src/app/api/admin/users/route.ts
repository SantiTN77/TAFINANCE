import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { serverDb } from "@/lib/supabase/server";
import { AdminError, audit, validateNewUser } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

const fail = (e: unknown) =>
  e instanceof AdminError
    ? NextResponse.json({ error: e.message }, { status: e.status })
    : NextResponse.json({ error: "Error interno" }, { status: 500 });

/** Lista usuarios con conteos (nunca contenido financiero). */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "Base de datos no configurada" }, { status: 503 });
  const { data, error } = await db.rpc("taf_admin_user_overview");
  if (error) return NextResponse.json({ error: "No se pudo listar usuarios" }, { status: 500 });
  return NextResponse.json({ users: data, me: guard.session.user.id }, { headers: { "Cache-Control": "no-store" } });
}

/** Crea un usuario ya activo (el registro público queda en 'pending' sin acceso a datos). */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "Base de datos no configurada" }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, role } = validateNewUser(body);
    // admin_created en app_metadata (no editable por el usuario) activa el perfil vía trigger
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { admin_created: true, role },
    });
    if (error || !data.user) {
      throw new AdminError(/already|registered|exists/i.test(error?.message || "") ? "Ese correo ya existe" : "No se pudo crear el usuario", 409);
    }
    await audit(db, guard.session.user.id, "create_user", data.user.id, { email, role });
    return NextResponse.json({ id: data.user.id, email, role }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
