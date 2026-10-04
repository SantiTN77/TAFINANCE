import {
  Account,
  Budget,
  Category,
  FinancialSummary,
  Pocket,
  Transaction,
} from "@/types/finance";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { buildSummary, computeBalances, monthKey, todayStr } from "@/lib/finance/calc";
import { logger } from "@/lib/debug/logger";

/**
 * Store financiero local-first.
 *
 * - En el navegador, el estado vive en memoria + localStorage y se emite a los
 *   suscriptores en cada cambio (gráficas y totales se recalculan al instante).
 * - Los cambios se envían a Supabase mediante una cola (outbox) persistente: si no hay
 *   red, se reintentan al volver la conexión. Nunca se pierden datos por un fallo remoto.
 * - Los saldos de las cuentas se DERIVAN de las transacciones (computeBalances), así
 *   nunca quedan desfasados respecto al historial.
 * - En el servidor (API routes / MCP) no hay localStorage: se lee de Supabase, se aplica
 *   el cambio y se espera a que se escriba antes de responder.
 */

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food", name: "Alimentación & Supermercado", icon: "ShoppingCart", color: "#8083ff", type: "EXPENSE" },
  { id: "cat-transport", name: "Transporte & Movilidad", icon: "Car", color: "#4cd7f6", type: "EXPENSE" },
  { id: "cat-home", name: "Vivienda & Servicios", icon: "Home", color: "#f59e0b", type: "EXPENSE" },
  { id: "cat-subscriptions", name: "Suscripciones & Digital", icon: "Laptop", color: "#8b5cf6", type: "EXPENSE" },
  { id: "cat-leisure", name: "Ocio & Restaurantes", icon: "Coffee", color: "#ec4899", type: "EXPENSE" },
  { id: "cat-health", name: "Salud & Bienestar", icon: "HeartPulse", color: "#ef4444", type: "EXPENSE" },
  { id: "cat-salary", name: "Salario & Nómina", icon: "Briefcase", color: "#4edea3", type: "INCOME" },
  { id: "cat-freelance", name: "Ingresos Extra & Freelance", icon: "TrendingUp", color: "#06b6d4", type: "INCOME" },
];

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "acc-main", name: "Cuenta Principal", type: "bank", balance: 0, currency: "COP" },
  { id: "acc-cash", name: "Billetera Efectivo", type: "cash", balance: 0, currency: "COP" },
  { id: "acc-savings", name: "Fondo de Ahorros", type: "savings", balance: 0, currency: "COP" },
];

type Table = "accounts" | "categories" | "transactions" | "pockets" | "budgets";

interface OutboxOp {
  id: string;
  table: Table;
  op: "upsert" | "delete";
  row?: Record<string, unknown>;
  rowId?: string;
  /** Reintentos por violación de integridad (p. ej. el padre aún no llegó). */
  attempts?: number;
}

const LS = {
  categories: "tafinance_categories",
  accounts: "tafinance_accounts",
  transactions: "tafinance_transactions",
  pockets: "tafinance_pockets",
  budgets: "tafinance_budgets",
  outbox: "tafinance_outbox",
};

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

/** Columnas que tienen las tablas remotas (evita enviar campos desconocidos). */
const REMOTE_COLUMNS: Record<Table, string[]> = {
  accounts: ["id", "name", "type", "balance", "currency", "cutoff_day", "due_day", "annual_yield", "remind_days_before", "created_at"],
  categories: ["id", "name", "icon", "color", "type"],
  transactions: [
    "id", "account_id", "category_id", "pocket_id", "to_account_id", "type", "amount", "currency",
    "description", "merchant", "receipt_url", "raw_prompt", "is_recurring", "recurrence_interval", "date", "created_at",
  ],
  pockets: ["id", "name", "target_amount", "current_amount", "icon", "color", "category", "auto_save_percentage", "created_at"],
  budgets: ["id", "category_id", "monthly_limit", "month"],
};

function pick(table: Table, row: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of REMOTE_COLUMNS[table]) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

class FinanceStore {
  private categories: Category[] = [...DEFAULT_CATEGORIES];
  private accounts: Account[] = [...DEFAULT_ACCOUNTS];
  private transactions: Transaction[] = [];
  private pockets: Pocket[] = [];
  private budgets: Budget[] = [];
  private outbox: OutboxOp[] = [];

  private readonly isBrowser = typeof window !== "undefined";
  private listeners = new Set<() => void>();
  private version = 0;
  private flushing: Promise<void> | null = null;
  private pulling: Promise<void> | null = null;
  private started = false;
  /** true cuando ya hay datos locales o terminó la primera sincronización. */
  private hydrated = false;
  private channel: any = null;
  private realtimeTimer: ReturnType<typeof setTimeout> | null = null;
  /** Estado de sincronización visible en la UI. */
  syncState: "idle" | "syncing" | "offline" | "error" | "local" = "idle";

  constructor() {
    if (this.isBrowser) this.loadFromLocalStorage();
  }

  /* ------------------------------ suscripción ------------------------------ */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private emit() {
    this.version++;
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        logger.error("store", "listener falló", e);
      }
    });
  }

  private setSync(s: FinanceStore["syncState"]) {
    if (this.syncState !== s) {
      this.syncState = s;
      this.emit();
    }
  }

  /** Arranca la sincronización (idempotente): pull inicial, eventos de red y realtime. */
  start() {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    logger.info("store", "Iniciando sincronización", { supabase: isSupabaseConfigured(), pendientes: this.outbox.length });

    const resync = () => {
      if (document.visibilityState === "visible") void this.sync();
    };
    window.addEventListener("online", () => void this.sync());
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("storage", (e) => {
      if (e.key && e.key.startsWith("tafinance_") && e.key !== LS.outbox) {
        this.loadFromLocalStorage();
        this.emit();
      }
    });

    if (isSupabaseConfigured() && supabase) {
      try {
        this.channel = supabase
          .channel("tafinance-live")
          .on("postgres_changes", { event: "*", schema: "public" }, (payload: any) => {
            logger.debug("realtime", "Cambio remoto", { table: payload.table, type: payload.eventType });
            if (this.realtimeTimer) clearTimeout(this.realtimeTimer);
            this.realtimeTimer = setTimeout(() => void this.pull(), 400);
          })
          .subscribe((status: string) => logger.debug("realtime", "estado canal", status));
      } catch (e) {
        logger.warn("realtime", "No disponible", e);
      }
    }
    void this.sync();
  }

  /* ------------------------------ persistencia local ------------------------------ */

  private loadFromLocalStorage() {
    try {
      const read = <T,>(k: string): T | null => {
        const v = localStorage.getItem(k);
        return v ? (JSON.parse(v) as T) : null;
      };
      const c = read<Category[]>(LS.categories);
      if (c?.length) this.categories = c;
      const a = read<Account[]>(LS.accounts);
      if (a?.length) this.accounts = a;
      this.transactions = read<Transaction[]>(LS.transactions) || [];
      this.pockets = read<Pocket[]>(LS.pockets) || [];
      this.budgets = read<Budget[]>(LS.budgets) || [];
      this.outbox = read<OutboxOp[]>(LS.outbox) || [];
      this.recomputeBalances();
      if (this.transactions.length > 0 || this.pockets.length > 0) this.hydrated = true;
    } catch (e) {
      logger.warn("store", "No se pudo leer localStorage", e);
    }
  }

  private saveToLocalStorage() {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(LS.categories, JSON.stringify(this.categories));
      localStorage.setItem(LS.accounts, JSON.stringify(this.accounts));
      localStorage.setItem(LS.transactions, JSON.stringify(this.transactions));
      localStorage.setItem(LS.pockets, JSON.stringify(this.pockets));
      localStorage.setItem(LS.budgets, JSON.stringify(this.budgets));
      localStorage.setItem(LS.outbox, JSON.stringify(this.outbox));
    } catch (e) {
      logger.warn("store", "No se pudo escribir localStorage", e);
    }
  }

  private recomputeBalances() {
    this.accounts = computeBalances(this.accounts, this.transactions);
  }

  /** Aplica un cambio: recalcula saldos, guarda, encola y notifica. */
  private commit(ops: OutboxOp[] = []) {
    const before = new Map(this.accounts.map((a) => [a.id, a.balance]));
    this.recomputeBalances();
    // Los saldos de cuentas que cambiaron también viajan al servidor
    for (const a of this.accounts) {
      if (before.get(a.id) !== a.balance) {
        ops.push({ id: uid("op"), table: "accounts", op: "upsert", row: pick("accounts", a) });
      }
    }
    // Las cuentas primero: las transacciones dependen de ellas (clave foránea)
    const accountOps = ops.filter((o) => o.table === "accounts" && o.op === "upsert");
    const rest = ops.filter((o) => !(o.table === "accounts" && o.op === "upsert"));
    this.outbox.push(...accountOps, ...rest);
    this.saveToLocalStorage();
    this.emit();
    if (ops.length) void this.flush();
  }

  private op(table: Table, row: object): OutboxOp {
    return { id: uid("op"), table, op: "upsert", row: pick(table, row as Record<string, any>) };
  }

  private del(table: Table, rowId: string): OutboxOp {
    return { id: uid("op"), table, op: "delete", rowId };
  }

  /* ------------------------------ sincronización ------------------------------ */

  private get remoteOn(): boolean {
    return isSupabaseConfigured() && !!supabase;
  }

  /** Envía la cola pendiente a Supabase (en orden). */
  flush(): Promise<void> {
    if (!this.remoteOn) {
      if (this.outbox.length) {
        this.outbox = [];
        this.saveToLocalStorage();
      }
      this.syncState = "local";
      this.emit();
      return Promise.resolve();
    }
    if (this.flushing) return this.flushing;
    if (this.isBrowser && !navigator.onLine) {
      this.setSync("offline");
      return Promise.resolve();
    }
    this.flushing = (async () => {
      this.setSync("syncing");
      try {
        // Reintenta sin salir hasta vaciar la cola o fallar
        while (this.outbox.length) {
          const op = this.outbox[0];
          const q = supabase!.from(op.table);
          let error: any = null;
          if (op.op === "upsert") {
            ({ error } = await q.upsert(op.row as any));
          } else {
            ({ error } = await q.delete().eq("id", op.rowId as string));
          }
          if (error) {
            const integrity = typeof error.code === "string" && error.code.startsWith("23");
            if (integrity && (op.attempts || 0) < 3) {
              // El registro padre quizá aún no está en el servidor: reintenta al final de la cola
              op.attempts = (op.attempts || 0) + 1;
              this.outbox.push(this.outbox.shift()!);
              logger.warn("sync", `Integridad en ${op.table}; reintento ${op.attempts}/3`, error.message);
              if (this.outbox.every((o) => (o.attempts || 0) > 0)) {
                this.setSync("error");
                return;
              }
              continue;
            }
            if (integrity) {
              // Descarta la operación irrecuperable para no bloquear el resto de la cola
              logger.error("sync", `Descartada ${op.op} en ${op.table}`, error.message);
              this.outbox.shift();
              this.saveToLocalStorage();
              continue;
            }
            logger.error("sync", `Fallo ${op.op} en ${op.table}`, error.message || error);
            this.setSync("error");
            return;
          }
          this.outbox.shift();
          this.saveToLocalStorage();
        }
        this.setSync("idle");
        logger.debug("sync", "Cola enviada");
      } catch (e) {
        logger.warn("sync", "Sin conexión con Supabase", e);
        this.setSync(this.isBrowser && !navigator.onLine ? "offline" : "error");
      }
    })().finally(() => {
      // Debe limpiarse DESPUÉS de asignar la promesa (si no hay awaits se ejecutaría antes)
      this.flushing = null;
    });
    return this.flushing;
  }

  /** Descarga el estado remoto (si no hay cambios locales pendientes). */
  pull(): Promise<void> {
    if (!this.remoteOn) return Promise.resolve();
    if (this.pulling) return this.pulling;
    this.pulling = (async () => {
      try {
        if (this.outbox.length) await this.flush();
        if (this.outbox.length) return; // aún hay cambios sin enviar: no pisar el estado local
        const [acc, cat, tx, pk, bg] = await Promise.all([
          supabase!.from("accounts").select("*"),
          supabase!.from("categories").select("*"),
          supabase!.from("transactions").select("*").order("date", { ascending: false }),
          supabase!.from("pockets").select("*"),
          supabase!.from("budgets").select("*"),
        ]);
        const firstError = [acc, cat, tx, pk, bg].find((r) => r.error);
        if (firstError?.error) {
          logger.warn("sync", "Pull parcial", firstError.error.message);
          return;
        }
        if (acc.data?.length) this.accounts = acc.data as Account[];
        else this.outbox.push(...this.accounts.map((a) => this.op("accounts", a)));
        if (cat.data?.length) this.categories = cat.data as Category[];
        else this.outbox.push(...this.categories.map((c) => this.op("categories", c)));
        if (this.outbox.length) {
          void this.flush();
        }
        this.transactions = ((tx.data || []) as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }));
        this.pockets = ((pk.data || []) as Pocket[]).map((p) => ({
          ...p,
          target_amount: Number(p.target_amount),
          current_amount: Number(p.current_amount),
        }));
        this.budgets = ((bg.data || []) as Budget[]).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) }));
        this.recomputeBalances();
        this.saveToLocalStorage();
        this.emit();
        logger.debug("sync", "Datos actualizados desde Supabase", {
          tx: this.transactions.length,
          pockets: this.pockets.length,
        });
      } catch (e) {
        logger.warn("sync", "Pull falló", e);
      }
    })().finally(() => {
      this.pulling = null;
    });
    return this.pulling;
  }

  async sync(): Promise<void> {
    try {
      await this.flush();
      await this.pull();
    } finally {
      if (!this.hydrated) {
        this.hydrated = true;
        this.emit();
      }
    }
  }

  /** Servidor: carga el estado remoto antes de operar; navegador: ya está en memoria. */
  private async ready() {
    if (!this.isBrowser && this.remoteOn) await this.pull();
  }

  /** Servidor: esperar a que lo escrito llegue a Supabase antes de responder. */
  private async settle() {
    if (!this.isBrowser) await this.flush();
  }

  /* ------------------------------ cuentas ------------------------------ */

  async getAccounts(): Promise<Account[]> {
    await this.ready();
    return this.accounts;
  }

  async addAccount(acc: Omit<Account, "id" | "balance" | "created_at"> & { balance?: number }): Promise<Account> {
    await this.ready();
    const account: Account = {
      ...acc,
      id: uid("acc"),
      balance: 0,
      currency: acc.currency || "COP",
      created_at: new Date().toISOString(),
    };
    this.accounts.push(account);
    this.commit([this.op("accounts", account)]);
    logger.info("store", "Cuenta creada", { name: account.name, type: account.type });
    // Saldo inicial → movimiento de ajuste (mantiene el saldo derivado del historial)
    if (acc.balance && acc.balance !== 0) {
      await this.adjustBalance(account.id, acc.balance, "Saldo inicial");
    }
    await this.settle();
    return account;
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account | null> {
    await this.ready();
    const i = this.accounts.findIndex((a) => a.id === id);
    if (i === -1) return null;
    const { balance: _ignored, ...rest } = updates;
    this.accounts[i] = { ...this.accounts[i], ...rest };
    this.commit([this.op("accounts", this.accounts[i])]);
    await this.settle();
    return this.accounts[i];
  }

  async deleteAccount(id: string): Promise<boolean> {
    await this.ready();
    if (this.accounts.length <= 1) return false;
    if (this.transactions.some((t) => t.account_id === id || t.to_account_id === id)) return false;
    this.accounts = this.accounts.filter((a) => a.id !== id);
    this.commit([this.del("accounts", id)]);
    await this.settle();
    return true;
  }

  /** Lleva el saldo de una cuenta a `target` creando un movimiento de ajuste. */
  async adjustBalance(accountId: string, target: number, description = "Ajuste de saldo"): Promise<Transaction | null> {
    await this.ready();
    const acc = this.accounts.find((a) => a.id === accountId);
    if (!acc) return null;
    const diff = Math.round((target - acc.balance) * 100) / 100;
    if (diff === 0) return null;
    return this.addTransaction({
      type: diff > 0 ? "INCOME" : "EXPENSE",
      amount: Math.abs(diff),
      currency: acc.currency || "COP",
      description,
      account_id: accountId,
      date: todayStr(),
    });
  }

  /** Mantiene compatibilidad con consumidores antiguos: ahora crea un ajuste. */
  async updateAccountBalance(accountId: string, newBalance: number): Promise<boolean> {
    return (await this.adjustBalance(accountId, newBalance)) !== null || this.accounts.some((a) => a.id === accountId && a.balance === newBalance);
  }

  /** Pago de tarjeta (o transferencia entre cuentas). */
  async transferBetweenAccounts(fromId: string, toId: string, amount: number, description?: string): Promise<Transaction | null> {
    await this.ready();
    const from = this.accounts.find((a) => a.id === fromId);
    const to = this.accounts.find((a) => a.id === toId);
    if (!from || !to || fromId === toId || !(amount > 0)) return null;
    return this.addTransaction({
      type: "TRANSFER",
      amount,
      currency: "COP",
      description: description || `${to.type === "credit" ? "Pago de tarjeta" : "Transferencia"}: ${from.name} → ${to.name}`,
      account_id: fromId,
      to_account_id: toId,
      date: todayStr(),
    });
  }

  /* ------------------------------ categorías ------------------------------ */

  async getCategories(): Promise<Category[]> {
    await this.ready();
    return this.categories;
  }

  /* ------------------------------ bolsillos ------------------------------ */

  async getPockets(): Promise<Pocket[]> {
    await this.ready();
    return this.pockets;
  }

  async addPocket(pocket: Omit<Pocket, "id" | "created_at">): Promise<Pocket> {
    await this.ready();
    const newPocket: Pocket = { ...pocket, id: uid("pkt"), created_at: new Date().toISOString() };
    this.pockets.push(newPocket);
    this.commit([this.op("pockets", newPocket)]);
    await this.settle();
    return newPocket;
  }

  async createPocket(pocket: Omit<Pocket, "id" | "created_at">): Promise<Pocket> {
    return this.addPocket(pocket);
  }

  async updatePocket(id: string, updates: Partial<Pocket>): Promise<Pocket | null> {
    await this.ready();
    const i = this.pockets.findIndex((p) => p.id === id);
    if (i === -1) return null;
    this.pockets[i] = { ...this.pockets[i], ...updates };
    this.commit([this.op("pockets", this.pockets[i])]);
    await this.settle();
    return this.pockets[i];
  }

  async deletePocket(id: string): Promise<boolean> {
    await this.ready();
    const i = this.pockets.findIndex((p) => p.id === id);
    if (i === -1) return false;
    this.pockets.splice(i, 1);
    // Los movimientos conservan el historial pero pierden el vínculo
    const ops: OutboxOp[] = [this.del("pockets", id)];
    this.transactions = this.transactions.map((t) => {
      if (t.pocket_id !== id) return t;
      const nt = { ...t, pocket_id: undefined };
      ops.push(this.op("transactions", { ...nt, pocket_id: null }));
      return nt;
    });
    this.commit(ops);
    await this.settle();
    return true;
  }

  /** Aporta dinero de una cuenta a un bolsillo (el patrimonio total no cambia). */
  async transferToPocket(pocketId: string, amount: number, accountId?: string): Promise<boolean> {
    await this.ready();
    const pocket = this.pockets.find((p) => p.id === pocketId);
    if (!pocket || !(amount > 0)) return false;
    const account =
      (accountId && this.accounts.find((a) => a.id === accountId)) ||
      this.accounts.find((a) => a.type !== "credit") ||
      this.accounts[0];

    pocket.current_amount = Number(pocket.current_amount) + amount;
    const ops = [this.op("pockets", pocket)];
    const tx = this.buildTx({
      type: "TRANSFER",
      amount,
      currency: "COP",
      description: `Aporte a bolsillo: ${pocket.name}`,
      pocket_id: pocketId,
      account_id: account?.id,
      date: todayStr(),
    });
    this.transactions.unshift(tx);
    ops.push(this.op("transactions", tx));
    this.commit(ops);
    await this.settle();
    return true;
  }

  /* ------------------------------ transacciones ------------------------------ */

  async getTransactions(): Promise<Transaction[]> {
    await this.ready();
    return [...this.transactions].sort((a, b) =>
      a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1
    );
  }

  private buildTx(tx: Omit<Transaction, "id" | "created_at">): Transaction {
    return {
      ...tx,
      amount: Number(tx.amount),
      account_id: tx.account_id || this.accounts.find((a) => a.type !== "credit")?.id || this.accounts[0]?.id,
      id: uid("tx"),
      created_at: new Date().toISOString(),
    };
  }

  async addTransaction(tx: Omit<Transaction, "id" | "created_at">): Promise<Transaction> {
    await this.ready();
    const newTx = this.buildTx(tx);
    this.transactions.unshift(newTx);
    this.commit([this.op("transactions", newTx)]);
    logger.info("store", "Movimiento registrado", {
      type: newTx.type,
      amount: newTx.amount,
      account: newTx.account_id,
      total: this.accounts.reduce((s, a) => s + a.balance, 0),
    });
    await this.settle();
    return newTx;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
    await this.ready();
    const i = this.transactions.findIndex((t) => t.id === id);
    if (i === -1) return null;
    this.transactions[i] = { ...this.transactions[i], ...updates };
    this.commit([this.op("transactions", this.transactions[i])]);
    await this.settle();
    return this.transactions[i];
  }

  /**
   * Registra la siguiente ocurrencia de un compromiso recurrente: crea el movimiento de hoy
   * como nueva plantilla y marca el anterior como ya ejecutado.
   */
  async executeRecurring(txId: string): Promise<Transaction | null> {
    await this.ready();
    const tpl = this.transactions.find((t) => t.id === txId);
    if (!tpl) return null;
    await this.updateTransaction(txId, { is_recurring: false });
    const { id: _id, created_at: _c, ...rest } = tpl;
    return this.addTransaction({ ...rest, is_recurring: true, date: todayStr() });
  }

  async deleteTransaction(id: string): Promise<boolean> {
    await this.ready();
    const i = this.transactions.findIndex((t) => t.id === id);
    if (i === -1) return false;
    const tx = this.transactions[i];
    const ops: OutboxOp[] = [this.del("transactions", id)];

    // Revertir aporte a bolsillo
    if (tx.type === "TRANSFER" && tx.pocket_id) {
      const pocket = this.pockets.find((p) => p.id === tx.pocket_id);
      if (pocket) {
        pocket.current_amount = Math.max(0, Number(pocket.current_amount) - Number(tx.amount));
        ops.push(this.op("pockets", pocket));
      }
    }
    this.transactions.splice(i, 1);
    this.commit(ops);
    await this.settle();
    return true;
  }

  /* ------------------------------ presupuestos ------------------------------ */

  async getBudgets(): Promise<Budget[]> {
    await this.ready();
    return this.budgets;
  }

  async setBudget(categoryId: string, monthlyLimit: number, month: string): Promise<Budget> {
    await this.ready();
    let budget = this.budgets.find((b) => b.category_id === categoryId && b.month === month);
    if (budget) {
      budget.monthly_limit = monthlyLimit;
    } else {
      budget = { id: uid("b"), category_id: categoryId, monthly_limit: monthlyLimit, month };
      this.budgets.push(budget);
    }
    this.commit([this.op("budgets", budget)]);
    await this.settle();
    return budget;
  }

  /* ------------------------------ resumen ------------------------------ */

  /** Snapshot síncrono para la UI (se recalcula en cada cambio emitido). */
  snapshot() {
    return {
      accounts: this.accounts,
      categories: this.categories,
      transactions: [...this.transactions].sort((a, b) =>
        a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1
      ),
      pockets: this.pockets,
      budgets: this.budgets,
      syncState: this.syncState,
      pending: this.outbox.length,
      hydrated: this.hydrated || !this.remoteOn,
    };
  }

  async getSummary(targetMonth = monthKey()): Promise<FinancialSummary> {
    await this.ready();
    return buildSummary(this.accounts, this.categories, this.transactions, this.budgets, this.pockets, targetMonth);
  }

  /* ------------------------------ reset y respaldo ------------------------------ */

  async clearAllData(): Promise<boolean> {
    await this.ready();
    const ops: OutboxOp[] = [];
    this.transactions.forEach((t) => ops.push(this.del("transactions", t.id)));
    this.pockets.forEach((p) => ops.push(this.del("pockets", p.id)));
    this.budgets.forEach((b) => ops.push(this.del("budgets", b.id)));
    this.transactions = [];
    this.pockets = [];
    this.budgets = [];
    this.commit(ops);
    await this.settle();
    logger.warn("store", "Datos reiniciados");
    return true;
  }

  exportBackup(): any {
    return {
      version: "2.1.0",
      exportedAt: new Date().toISOString(),
      accounts: this.accounts,
      categories: this.categories,
      pockets: this.pockets,
      budgets: this.budgets,
      transactions: this.transactions,
    };
  }

  exportBackupJson(): string {
    return JSON.stringify(this.exportBackup(), null, 2);
  }
}

export const financeStore = new FinanceStore();
