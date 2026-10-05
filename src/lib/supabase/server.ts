import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase SOLO para el servidor (API routes, MCP, cron).
 *
 * Usa la clave service_role, que salta RLS. Las tablas no tienen políticas para
 * anon/authenticated (ver supabase/migrations/20261004_lockdown_rls.sql), así que la
 * única vía a los datos es este cliente detrás del middleware (sesión PIN/biometría)
 * o de MCP_TOKEN. Nunca importes este módulo desde un componente de cliente.
 *
 * Falla cerrado: sin SUPABASE_SERVICE_ROLE_KEY devuelve null (no cae a la clave anónima).
 */
let cached: SupabaseClient | null | undefined;

export function serverDb(): SupabaseClient | null {
  if (typeof window !== "undefined") return null;
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith("http")) {
    if (url && !key) console.warn("[TAF][db] SUPABASE_SERVICE_ROLE_KEY no definido: datos remotos deshabilitados.");
    cached = null;
    return cached;
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
