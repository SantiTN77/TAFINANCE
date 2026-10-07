import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Administración de usuarios (solo servidor, service_role). El admin gestiona CUENTAS, nunca
 * ve datos financieros ajenos: el resumen solo trae conteos (taf_admin_user_overview).
 */

export const MIN_PASSWORD = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class AdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface AdminProfile {
  id: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled" | "pending";
}

export function validateNewUser(input: { email?: unknown; password?: unknown; role?: unknown }) {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const role = input.role === "admin" ? "admin" : "user";
  if (!EMAIL_RE.test(email) || email.length > 254) throw new AdminError("Correo inválido");
  if (password.length < MIN_PASSWORD) throw new AdminError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
  return { email, password, role } as const;
}

/**
 * Reglas que evitan dejar el sistema sin administración:
 *  - nadie cambia su propio rol/estado ni se borra a sí mismo desde el panel;
 *  - no se puede degradar, deshabilitar ni borrar al último admin activo.
 */
export function assertSafeChange(opts: {
  actorId: string;
  target: AdminProfile;
  activeAdmins: number;
  change: { status?: string; role?: string; delete?: boolean };
}) {
  const { actorId, target, activeAdmins, change } = opts;
  const touchesAccess = change.delete || change.status !== undefined || change.role !== undefined;
  if (touchesAccess && target.id === actorId) {
    throw new AdminError("No puedes cambiar el rol/estado ni borrar tu propia cuenta desde el panel", 409);
  }
  const removesAdmin =
    target.role === "admin" &&
    target.status === "active" &&
    (change.delete || (change.status !== undefined && change.status !== "active") || (change.role !== undefined && change.role !== "admin"));
  if (removesAdmin && activeAdmins <= 1) throw new AdminError("Debe quedar al menos un administrador activo", 409);
}

export async function audit(db: SupabaseClient, actor: string, action: string, target: string | null, detail: object = {}) {
  const { error } = await db.from("admin_audit").insert({ actor, action, target, detail });
  if (error) console.error("[TAF][admin] no se pudo auditar:", action, error.message);
}

export async function countActiveAdmins(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "active");
  if (error) throw new AdminError("No se pudo verificar los administradores", 500);
  return count || 0;
}

export async function getProfile(db: SupabaseClient, id: string): Promise<AdminProfile> {
  const { data, error } = await db.from("profiles").select("id,email,role,status").eq("id", id).maybeSingle();
  if (error) throw new AdminError("No se pudo leer el usuario", 500);
  if (!data) throw new AdminError("Usuario no encontrado", 404);
  return data as AdminProfile;
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
