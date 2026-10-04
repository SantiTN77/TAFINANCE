import { financeStore, RemoteBackend } from "@/lib/storage/finance-store";
import { serverDb } from "@/lib/supabase/server";
import { applyOps, fetchSnapshot } from "@/lib/supabase/data-ops";

/**
 * Store para el servidor (API routes, MCP): lee y escribe en Supabase con service_role.
 * Importa SIEMPRE desde aquí en código de servidor; los componentes usan finance-store.
 */
const directBackend: RemoteBackend = {
  async apply(ops) {
    const db = serverDb();
    return db ? applyOps(db, ops) : { disabled: true };
  },
  async fetch() {
    const db = serverDb();
    if (!db) return { disabled: true };
    const { data, error } = await fetchSnapshot(db);
    if (error || !data) throw new Error(error || "Snapshot vacío");
    return data;
  },
};

financeStore.setRemoteBackend(directBackend);

export { financeStore };
