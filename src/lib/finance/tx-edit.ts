import { Transaction } from "@/types/finance";

/**
 * Reglas puras para editar movimientos. El store las usa para que un cambio desde la UI,
 * la API REST o el MCP produzca siempre el mismo resultado y deje bolsillos y saldos coherentes.
 */

export class TxValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxValidationError";
  }
}

/** Campos opcionales que se pueden vaciar (en Supabase viajan como null). */
const CLEARABLE = ["merchant", "category_id", "pocket_id", "recurrence_interval"] as const;
type Clearable = (typeof CLEARABLE)[number];

const INTERVALS = ["MONTHLY", "BIWEEKLY", "WEEKLY", "YEARLY"] as const;

/** Gasto e ingreso se pueden intercambiar; transferencias (y ajustes) mantienen su tipo y sus vínculos. */
export const isEditableType = (t: string): t is "EXPENSE" | "INCOME" => t === "EXPENSE" || t === "INCOME";

export interface TxPatch {
  /** Campos a sobrescribir. */
  patch: Partial<Transaction>;
  /** Campos a eliminar del movimiento. */
  cleared: Clearable[];
}

const isEmpty = (v: unknown) => v === null || (typeof v === "string" && v.trim() === "");

function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Valida y normaliza los cambios pedidos sobre `current`. Ignora campos no editables
 * (id, created_at, moneda, prompt original…) y lanza TxValidationError si algo no es válido.
 */
export function sanitizeTxUpdates(current: Transaction, updates: Record<string, unknown>): TxPatch {
  const patch: Partial<Transaction> = {};
  const cleared: Clearable[] = [];
  const has = (k: string) => Object.prototype.hasOwnProperty.call(updates, k) && updates[k] !== undefined;

  if (has("type")) {
    const t = updates.type;
    if (t !== "EXPENSE" && t !== "INCOME" && t !== "TRANSFER") throw new TxValidationError("Tipo inválido");
    if (t !== current.type && (!isEditableType(t) || !isEditableType(current.type))) {
      throw new TxValidationError("Solo se puede cambiar entre gasto e ingreso (transferencias y ajustes conservan su tipo)");
    }
    patch.type = t;
  }

  if (has("amount")) {
    const n = typeof updates.amount === "string" ? Number(updates.amount) : (updates.amount as number);
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) throw new TxValidationError("El monto debe ser mayor que 0");
    patch.amount = Math.round(n * 100) / 100;
  }

  if (has("description")) {
    const d = typeof updates.description === "string" ? updates.description.trim() : "";
    if (!d) throw new TxValidationError("La descripción es obligatoria");
    patch.description = d.slice(0, 200);
  }

  if (has("date")) {
    if (!validDate(updates.date)) throw new TxValidationError("Fecha inválida (YYYY-MM-DD)");
    patch.date = updates.date as string;
  }

  if (has("account_id")) {
    if (typeof updates.account_id !== "string" || !updates.account_id) throw new TxValidationError("Cuenta inválida");
    patch.account_id = updates.account_id;
  }

  if (has("to_account_id")) {
    if (current.type !== "TRANSFER") throw new TxValidationError("Solo las transferencias tienen cuenta destino");
    if (typeof updates.to_account_id !== "string" || !updates.to_account_id) throw new TxValidationError("Cuenta destino inválida");
    patch.to_account_id = updates.to_account_id;
  }

  for (const k of ["merchant", "category_id", "pocket_id"] as const) {
    if (!has(k)) continue;
    if (isEmpty(updates[k])) {
      if (current[k] !== undefined && current[k] !== null) cleared.push(k);
      continue;
    }
    if (typeof updates[k] !== "string") throw new TxValidationError(`Valor inválido para ${k}`);
    patch[k] = k === "merchant" ? (updates[k] as string).trim().slice(0, 120) : (updates[k] as string);
  }

  if (has("is_recurring")) {
    if (typeof updates.is_recurring !== "boolean") throw new TxValidationError("is_recurring debe ser booleano");
    patch.is_recurring = updates.is_recurring;
  }
  if (has("recurrence_interval")) {
    const r = updates.recurrence_interval;
    if (isEmpty(r)) {
      if (current.recurrence_interval) cleared.push("recurrence_interval");
    } else if (!INTERVALS.includes(r as (typeof INTERVALS)[number])) {
      throw new TxValidationError("Periodicidad inválida");
    } else {
      patch.recurrence_interval = r as Transaction["recurrence_interval"];
    }
  }
  const next = { ...current, ...patch };
  if (next.type === "TRANSFER" && next.to_account_id && next.to_account_id === next.account_id) {
    throw new TxValidationError("La cuenta origen y destino deben ser distintas");
  }

  return { patch, cleared };
}

/** Aplica un TxPatch: devuelve el movimiento local y la fila remota (con null en los vaciados). */
export function applyTxPatch(current: Transaction, { patch, cleared }: TxPatch): { next: Transaction; remote: Record<string, unknown> } {
  const next: Transaction = { ...current, ...patch };
  const remote: Record<string, unknown> = { ...next };
  for (const k of cleared) {
    delete next[k];
    remote[k] = null;
  }
  return { next, remote };
}

/** Dinero que un movimiento aportó a un bolsillo (solo los aportes, que son TRANSFER). */
export function pocketContribution(tx: Transaction | null | undefined): { pocketId: string; amount: number } | null {
  if (!tx || tx.type !== "TRANSFER" || !tx.pocket_id) return null;
  return { pocketId: tx.pocket_id, amount: Number(tx.amount) };
}

/**
 * Cuánto debe moverse cada bolsillo al pasar de `before` a `after`
 * (after = null cuando el movimiento se borra).
 */
export function pocketDeltas(before: Transaction | null, after: Transaction | null): Map<string, number> {
  const out = new Map<string, number>();
  const add = (c: ReturnType<typeof pocketContribution>, sign: 1 | -1) => {
    if (!c) return;
    out.set(c.pocketId, Math.round(((out.get(c.pocketId) || 0) + sign * c.amount) * 100) / 100);
  };
  add(pocketContribution(before), -1);
  add(pocketContribution(after), 1);
  for (const [k, v] of out) if (v === 0) out.delete(k);
  return out;
}
