import { FinanceStore, RemoteBackend } from "@/lib/storage/finance-store";
import { applyOps, fetchSnapshot } from "@/lib/supabase/data-ops";
import { serverDb } from "@/lib/supabase/server";
import { requireActiveUser } from "@/lib/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Stores para el servidor (API routes, MCP). NO hay singleton compartido: cada petición
 * crea un store ligado a UN usuario, así una petición nunca puede leer ni escribir datos
 * de otro. Importa SIEMPRE desde aquí en código de servidor; los componentes usan finance-store.
 */
export function createUserStore(db: SupabaseClient, userId: string): FinanceStore {
  const backend: RemoteBackend = {
    async apply(ops) {
      return applyOps(db, userId, ops);
    },
    async fetch() {
      const { data, error } = await fetchSnapshot(db, userId);
      if (error || !data) throw new Error(error || "Snapshot vacío");
      return data;
    },
  };
  const store = new FinanceStore();
  store.setRemoteBackend(backend);
  return store;
}

export type StoreResult =
  | { ok: true; store: FinanceStore; userId: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

/** Store del usuario con sesión (cookie). Las escrituras pasan por RLS con su JWT. */
export async function storeForRequest(): Promise<StoreResult> {
  const guard = await requireActiveUser();
  if (!guard.ok) return guard;
  const { user, db } = guard.session;
  return { ok: true, store: createUserStore(db, user.id), userId: user.id };
}

/**
 * Store para MCP: autenticado por MCP_TOKEN, ligado al usuario MCP_USER_ID (uuid) con service_role.
 * Falla cerrado sin MCP_USER_ID: un token compartido no puede elegir de quién son los datos.
 */
export function storeForMcp(): StoreResult {
  const userId = process.env.MCP_USER_ID;
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { ok: false, status: 503, error: "MCP deshabilitado: define MCP_USER_ID (uuid del usuario dueño de los datos)." };
  }
  const db = serverDb();
  if (!db) return { ok: false, status: 503, error: "Base de datos no configurada" };
  return { ok: true, store: createUserStore(db, userId), userId };
}
