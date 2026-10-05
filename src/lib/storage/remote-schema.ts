/** Tablas y columnas que el cliente puede sincronizar con Supabase (lista blanca). */
export type Table = "accounts" | "categories" | "transactions" | "pockets" | "budgets";

export const REMOTE_COLUMNS: Record<Table, string[]> = {
  accounts: ["id", "name", "type", "balance", "currency", "cutoff_day", "due_day", "annual_yield", "remind_days_before", "created_at"],
  categories: ["id", "name", "icon", "color", "type"],
  transactions: [
    "id", "account_id", "category_id", "pocket_id", "to_account_id", "type", "amount", "currency",
    "description", "merchant", "receipt_url", "raw_prompt", "is_recurring", "recurrence_interval", "date", "created_at",
  ],
  pockets: ["id", "name", "target_amount", "current_amount", "icon", "color", "category", "auto_save_percentage", "created_at"],
  budgets: ["id", "category_id", "monthly_limit", "month"],
};

export const TABLES = Object.keys(REMOTE_COLUMNS) as Table[];

export interface RemoteOp {
  table: Table;
  op: "upsert" | "delete";
  row?: Record<string, unknown>;
  rowId?: string;
}

/** Código de error para operaciones que el servidor rechaza por formato (no se reintentan). */
export const INVALID_OP_CODE = "TAF_INVALID";

export interface RemoteError {
  code?: string;
  message: string;
}

/** Resultado de aplicar una cola: cuántas operaciones entraron y el error de la siguiente. */
export interface ApplyResult {
  applied: number;
  error?: RemoteError;
}

export type RemoteSnapshot = Record<Table, Record<string, unknown>[]>;

export function pick(table: Table, row: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of REMOTE_COLUMNS[table]) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}
