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

/** Aplica la cola en orden y se detiene en el primer error (el cliente decide si reintenta). */
export async function applyOps(db: SupabaseClient, ops: RemoteOp[]): Promise<ApplyResult> {
  let applied = 0;
  for (const op of ops) {
    const q = db.from(op.table);
    const { error } =
      op.op === "upsert" ? await q.upsert(op.row as any) : await q.delete().eq("id", op.rowId as string);
    if (error) return { applied, error: { code: error.code, message: error.message } };
    applied++;
  }
  return { applied };
}

export async function fetchSnapshot(db: SupabaseClient): Promise<{ data?: RemoteSnapshot; error?: string }> {
  const results = await Promise.all(
    TABLES.map((t) =>
      t === "transactions" ? db.from(t).select("*").order("date", { ascending: false }) : db.from(t).select("*")
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  const data = {} as RemoteSnapshot;
  TABLES.forEach((t, i) => (data[t] = (results[i].data || []) as Record<string, unknown>[]));
  return { data };
}
