import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { serverDb } from "@/lib/supabase/server";

/**
 * Sesión por usuario (Supabase Auth). Solo servidor.
 *
 * Los datos se leen/escriben con un cliente que lleva el JWT del usuario: RLS (auth.uid())
 * es la barrera real. service_role solo se usa para administración y tareas del sistema.
 */

export type Role = "user" | "admin";
export type Status = "active" | "disabled" | "pending";

export interface SessionInfo {
  user: User;
  /** Cliente con el JWT del usuario (sujeto a RLS). */
  db: SupabaseClient;
  role: Role;
  status: Status;
  /** Métodos con los que se autenticó el JWT actual (password, otp, ...). */
  amr: string[];
}

export function supabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey && url.startsWith("http") ? { url, anonKey } : null;
}

/** Cliente SSR ligado a las cookies de la petición (puede refrescar/emitir la sesión). */
export async function createCookieClient(): Promise<SupabaseClient | null> {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  const jar = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* en Server Components no se pueden escribir cookies: el middleware ya refresca */
        }
      },
    },
  });
}

/** Lee el claim `amr` del JWT ya validado por getUser() (no se usa para confiar, solo para exigir contraseña). */
export function amrMethods(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    return Array.isArray(payload.amr) ? payload.amr.map((a: { method?: string }) => String(a?.method)) : [];
  } catch {
    return [];
  }
}

/**
 * Usuario autenticado + perfil. null si no hay sesión válida.
 * `getUser()` valida el JWT contra Auth (no se confía en la cookie sin verificarla).
 */
export async function getSession(): Promise<SessionInfo | null> {
  const client = await createCookieClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const {
    data: { session },
  } = await client.auth.getSession();

  const { data: profile } = await client.from("profiles").select("role,status").eq("id", data.user.id).maybeSingle();
  return {
    user: data.user,
    db: client,
    role: profile?.role === "admin" ? "admin" : "user",
    status: (profile?.status as Status) || "pending",
    amr: amrMethods(session?.access_token),
  };
}

/** ¿Es la cuenta del dueño (TAFINANCE_OWNER_EMAIL)? Solo ella puede usar PIN/biometría. */
export function isOwner(s: SessionInfo): boolean {
  const owner = process.env.TAFINANCE_OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && s.role === "admin" && s.user.email?.toLowerCase() === owner;
}

export type GuardResult = { ok: true; session: SessionInfo } | { ok: false; status: 401 | 403; error: string };

/** Sesión válida Y cuenta activa. */
export async function requireActiveUser(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "No autenticado" };
  if (session.status !== "active") return { ok: false, status: 403, error: "Cuenta no activa" };
  return { ok: true, session };
}

/**
 * Admin: rol admin + cuenta activa + sesión iniciada con CONTRASEÑA en esta sesión
 * (un desbloqueo por PIN/biométrico del dueño no basta para administrar usuarios).
 */
export async function requireAdmin(): Promise<GuardResult> {
  const r = await requireActiveUser();
  if (!r.ok) return r;
  if (r.session.role !== "admin") return { ok: false, status: 403, error: "Requiere rol admin" };
  if (!r.session.amr.includes("password")) {
    return { ok: false, status: 403, error: "Vuelve a iniciar sesión con tu contraseña para administrar usuarios" };
  }
  return r;
}

/** Cliente anónimo sin sesión (solo para validar credenciales en el login). */
export function anonClient(): SupabaseClient | null {
  const cfg = supabasePublicConfig();
  return cfg ? createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export { serverDb };
