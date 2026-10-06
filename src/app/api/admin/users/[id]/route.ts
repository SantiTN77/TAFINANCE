import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { serverDb } from "@/lib/supabase/server";
import {
  AdminError, assertSafeChange, audit, countActiveAdmins, getProfile, isUuid, MIN_PASSWORD,
} from "@/lib/admin/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const fail = (e: unknown) =>
  e instanceof AdminError
    ? NextResponse.json({ error: e.message }, { status: e.status })
    : NextResponse.json({ error: "Error interno" }, { status: 500 });

/** Cambia estado (active/disabled), rol (user/admin) y/o restablece la contraseña. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "Base de datos no configurada" }, { status: 503 });
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new AdminError("Id inválido");
    const body = await req.json().catch(() => ({}));
    const status = body.status === undefined ? undefined : String(body.status);
    const role = body.role === undefined ? undefined : String(body.role);
    const password = body.password === undefined ? undefined : String(body.password);
    if (status !== undefined && !["active", "disabled"].includes(status)) throw new AdminError("Estado inválido");
    if (role !== undefined && !["user", "admin"].includes(role)) throw new AdminError("Rol inválido");
    if (password !== undefined && password.length < MIN_PASSWORD) throw new AdminError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
    if (status === undefined && role === undefined && password === undefined) throw new AdminError("Nada que cambiar");

    const actor = guard.session.user.id;
    const target = await getProfile(db, id);
    assertSafeChange({ actorId: actor, target, activeAdmins: await countActiveAdmins(db), change: { status, role } });

    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) profileUpdate.status = status;
    if (role) profileUpdate.role = role;
    if (status || role) {
      const { error } = await db.from("profiles").update(profileUpdate).eq("id", id);
      if (error) throw new AdminError("No se pudo actualizar el perfil", 500);
    }

    const authUpdate: Record<string, unknown> = {};
    if (status) authUpdate.ban_duration = status === "disabled" ? "876000h" : "none"; // corta el refresco de sesión
    if (role || status) authUpdate.app_metadata = { ...(role ? { role } : {}), ...(status ? { status } : {}) };
    if (password) authUpdate.password = password;
    const { error: aerr } = await db.auth.admin.updateUserById(id, authUpdate);
    if (aerr) throw new AdminError("El perfil se actualizó pero Auth rechazó el cambio", 502);

    if (status) await audit(db, actor, "set_status", id, { from: target.status, to: status });
    if (role) await audit(db, actor, "set_role", id, { from: target.role, to: role });
    if (password) await audit(db, actor, "reset_password", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** Borra la cuenta y TODOS sus datos (cascada). Exige confirmar escribiendo el correo. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const db = serverDb();
  if (!db) return NextResponse.json({ error: "Base de datos no configurada" }, { status: 503 });
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new AdminError("Id inválido");
    const body = await req.json().catch(() => ({}));
    const actor = guard.session.user.id;
    const target = await getProfile(db, id);
    if (String(body.confirmEmail || "").trim().toLowerCase() !== target.email.toLowerCase()) {
      throw new AdminError("Confirma escribiendo el correo exacto del usuario");
    }
    assertSafeChange({ actorId: actor, target, activeAdmins: await countActiveAdmins(db), change: { delete: true } });
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new AdminError("No se pudo borrar el usuario", 502);
    await audit(db, actor, "delete_user", id, { email: target.email });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
