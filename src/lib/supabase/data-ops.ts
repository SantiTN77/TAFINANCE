import type { SupabaseClient } from "@supabase/supabase-js";
import { ApplyResult, pick, RemoteOp, RemoteSnapshot, Table, TABLES } from "@/lib/storage/remote-schema";

export const MAX_OPS_PER_BATCH = 200;

/** Valida una operación de la cola del cliente; devuelve null si no es aceptable. */
export function sanitizeOp(raw: unknown): RemoteOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const table = o.table as Table;
  if (!TABLES.includes(table)) return null;
  if (o.op === "delete") {
    return typeof o.rowId === "string" && o.rowId ? { table, op: "delete", rowId: o.rowId } : null;
  }
  if (o.op === "upsert" && o.row && typeof o.row === "object") {
    const row = pick(table, o.row as Record<string, unknown>);
    return typeof row.id === "string" && row.id ? { table, op: "upsert", row } : null;
  }
  return null;
}

/**
 * Aplica la cola en orden y se detiene en el primer error (el cliente decide si reintenta).
 * `userId` se fuerza en cada fila (el cliente no puede escribir en otro usuario) y también
 * se filtra en los borrados: es defensa en profundidad, la barrera real es RLS (auth.uid()).
 */
export async function applyOps(db: SupabaseClient, userId: string, ops: RemoteOp[]): Promise<ApplyResult> {
  let applied = 0;
  for (const op of ops) {
    const q = db.from(op.table);
    const { error } =
      op.op === "upsert"
        ? await q.upsert({ ...(op.row as object), user_id: userId } as any, { onConflict: "user_id,id" })
        : await q.delete().eq("user_id", userId).eq("id", op.rowId as string);
    if (error) return { applied, error: { code: error.code, message: error.message } };
    applied++;
  }
  return { applied };
}

export async function fetchSnapshot(
  db: SupabaseClient,
  userId: string
): Promise<{ data?: RemoteSnapshot; error?: string }> {
  const results = await Promise.all(
    TABLES.map((t) => {
      const q = db.from(t).select("*").eq("user_id", userId);
      return t === "transactions" ? q.order("date", { ascending: false }) : q;
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  const data = {} as RemoteSnapshot;
  // user_id es interno: no viaja al navegador
  TABLES.forEach((t, i) => {
    data[t] = ((results[i].data || []) as Record<string, unknown>[]).map(({ user_id: _u, ...rest }) => rest);
  });
  return { data };
}
