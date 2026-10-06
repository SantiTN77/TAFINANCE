import { serverDb } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/auth/session";

export type MintResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Desbloqueo rápido del DUEÑO (PIN o biometría): abre una sesión real de Supabase Auth para
 * TAFINANCE_OWNER_EMAIL generando un enlace mágico en el servidor y canjeándolo al instante
 * (el token nunca sale del servidor). Solo sirve para esa cuenta y solo si es admin activa.
 * Es una sesión sin contraseña (amr "otp"): no da acceso al panel admin.
 */
export async function mintOwnerSession(): Promise<MintResult> {
  const email = process.env.TAFINANCE_OWNER_EMAIL?.trim().toLowerCase();
  const db = serverDb();
  if (!email || !db) return { ok: false, status: 503, error: "Desbloqueo rápido no configurado (TAFINANCE_OWNER_EMAIL)" };

  const { data: profile } = await db
    .from("profiles")
    .select("id,role,status")
    .ilike("email", email)
    .maybeSingle();
  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    return { ok: false, status: 403, error: "Cuenta de dueño no activa" };
  }

  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return { ok: false, status: 502, error: "No se pudo abrir la sesión" };

  const client = await createCookieClient();
  if (!client) return { ok: false, status: 503, error: "Auth no configurado" };
  const { error: verr } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verr) return { ok: false, status: 502, error: "No se pudo abrir la sesión" };
  return { ok: true };
}
