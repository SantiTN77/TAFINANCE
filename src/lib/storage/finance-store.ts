import {
  Account,
  Budget,
  Category,
  FinancialSummary,
  Pocket,
  Transaction,
} from "@/types/finance";
import {
  ApplyResult,
  INVALID_OP_CODE,
  pick,
  RemoteOp,
  RemoteSnapshot,
  Table,
} from "@/lib/storage/remote-schema";
import { buildSummary, computeLedger, monthKey, todayStr } from "@/lib/finance/calc";
import { logger } from "@/lib/debug/logger";
import { TxValidationError, applyTxPatch, sanitizeTxUpdates } from "@/lib/finance/tx-edit";

/**
 * Store financiero local-first.
 *
 * - En el navegador, el estado vive en memoria + localStorage y se emite a los
 *   suscriptores en cada cambio (gráficas y totales se recalculan al instante).
 * - Los cambios se envían a Supabase mediante una cola (outbox) persistente: si no hay
 *   red, se reintentan al volver la conexión. Nunca se pierden datos por un fallo remoto.
 * - El navegador NO habla con Supabase: usa /api/data (protegido por la sesión). Solo el
 *   servidor tiene la clave service_role; la BD rechaza la clave anónima.
 * - Los saldos de las cuentas se DERIVAN de las transacciones (computeLedger), así
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

interface OutboxOp extends RemoteOp {
  id: string;
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
  owner: "tafinance_owner",
};

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

/** Respuesta del backend cuando la BD remota no está configurada en el servidor. */
type Disabled = { disabled: true };

export interface RemoteBackend {
  apply(ops: RemoteOp[]): Promise<ApplyResult | Disabled>;
  fetch(): Promise<RemoteSnapshot | Disabled>;
}

/** Navegador: todo pasa por /api/data con la cookie de sesión. */
const httpBackend: RemoteBackend = {
  async apply(ops) {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops: ops.map(({ table, op, row, rowId }) => ({ table, op, row, rowId })) }),
    });
    return readResponse<ApplyResult>(res);
  },
  async fetch() {
    const res = await fetch("/api/data", { cache: "no-store" });
    return readResponse<RemoteSnapshot>(res);
  },
};

async function readResponse<T>(res: Response): Promise<T | Disabled> {
  const body = await res.json().catch(() => ({}));
  if (res.status === 503 && body?.disabled) return { disabled: true };
  if (!res.ok) throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  return body as T;
}

/**
 * Servidor sin backend registrado: modo local. Las API routes / MCP deben importar el store
 * desde "@/lib/storage/server-store", que registra el acceso directo con service_role
 * (así el cliente de Supabase nunca entra en el bundle del navegador).
 */
const noBackend: RemoteBackend = {
  apply: async () => ({ disabled: true }),
  fetch: async () => ({ disabled: true }),
};

const isDisabled = (r: unknown): r is Disabled => !!r && typeof r === "object" && (r as Disabled).disabled === true;

const BATCH_SIZE = 100;
const POLL_MS = 30_000;

export class FinanceStore {
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
  private backend: RemoteBackend = this.isBrowser ? httpBackend : noBackend;
  /** "unknown" hasta la primera respuesta del servidor; "off" = sin BD remota (modo local). */
  private remoteMode: "unknown" | "on" | "off" = "unknown";
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Estado de sincronización visible en la UI. */
  syncState: "idle" | "syncing" | "offline" | "error" | "local" = "idle";

  constructor() {
    if (this.isBrowser) this.loadFromLocalStorage();
  }

  /** Solo servidor: conecta el store a Supabase (ver server-store.ts). */
  setRemoteBackend(backend: RemoteBackend) {
    if (this.isBrowser) return;
    this.backend = backend;
    this.remoteMode = "unknown";
  }

  /**
   * Navegador: la caché local pertenece a UN usuario. Si la sesión actual es de otro (o no
   * hay marca previa pero sí datos), se descarta antes de sincronizar para no mezclar ni mostrar
   * datos ajenos en un dispositivo compartido.
   */
  async bindUser(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id?: string };
      if (!id) return;
      const prev = localStorage.getItem(LS.owner);
      if (prev !== id) {
        this.wipeLocal();
        localStorage.setItem(LS.owner, id);
      }
    } catch (e) {
      logger.warn("store", "No se pudo verificar el usuario de la caché", e);
    }
  }

  /** Borra la caché local (memoria + localStorage), p. ej. al cerrar sesión. */
  wipeLocal() {
    if (!this.isBrowser) return;
    this.categories = [...DEFAULT_CATEGORIES];
    this.accounts = [...DEFAULT_ACCOUNTS];
    this.transactions = [];
    this.pockets = [];
    this.budgets = [];
    this.outbox = [];
    this.hydrated = false;
    try {
      Object.values(LS).forEach((k) => localStorage.removeItem(k));
    } catch {}
    this.recomputeBalances();
    this.emit();
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

  /** Arranca la sincronización (idempotente): pull inicial, eventos de red y sondeo periódico. */
  start() {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    logger.info("store", "Iniciando sincronización", { pendientes: this.outbox.length });

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

    // Sin realtime (exigiría exponer la BD al navegador): sondeo ligero con la app visible
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === "visible" && this.remoteMode !== "off") void this.pull();
    }, POLL_MS);
    void this.bindUser().then(() => this.sync());
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

  /** Saldos de cuentas y bolsillos: siempre derivados del historial. */
  private recomputeBalances() {
    const ledger = computeLedger(this.accounts, this.transactions, this.pockets);
    this.accounts = ledger.accounts;
    this.pockets = ledger.pockets;
  }

  /** Aplica un cambio: recalcula saldos, guarda, encola y notifica. */
  private commit(ops: OutboxOp[] = []) {
    const before = new Map(this.accounts.map((a) => [a.id, a.balance]));
    const pocketsBefore = new Map(this.pockets.map((p) => [p.id, p.current_amount]));
    this.recomputeBalances();
    // Los saldos derivados que cambiaron también viajan al servidor (lecturas de API/MCP)
    for (const a of this.accounts) {
      if (before.get(a.id) !== a.balance) {
        ops.push({ id: uid("op"), table: "accounts", op: "upsert", row: pick("accounts", a) });
      }
    }
    for (const p of this.pockets) {
      if (pocketsBefore.has(p.id) && pocketsBefore.get(p.id) !== p.current_amount) {
        ops.push({ id: uid("op"), table: "pockets", op: "upsert", row: pick("pockets", p) });
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
    return this.remoteMode !== "off";
  }

  private markDisabled() {
    if (this.remoteMode !== "off") logger.info("sync", "BD remota no configurada: modo local");
    this.remoteMode = "off";
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
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
          const batch = this.outbox.slice(0, BATCH_SIZE);
          const result = await this.backend.apply(batch);
          if (isDisabled(result)) {
            this.markDisabled();
            this.outbox = [];
            this.saveToLocalStorage();
            this.syncState = "local";
            this.emit();
            return;
          }
          this.remoteMode = "on";
          // Saca de la cola lo que ya quedó escrito (en orden)
          const done = new Set(batch.slice(0, result.applied).map((o) => o.id));
          this.outbox = this.outbox.filter((o) => !done.has(o.id));
          this.saveToLocalStorage();
          const error = result.error;
          if (!error) continue;

          const op = this.outbox[0];
          if (!op) break;
          if (error.code === INVALID_OP_CODE) {
            logger.error("sync", `Descartada ${op.op} inválida en ${op.table}`, error.message);
            this.outbox.shift();
            this.saveToLocalStorage();
            continue;
          }
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
          logger.error("sync", `Fallo ${op.op} en ${op.table}`, error.message);
          this.setSync("error");
          return;
        }
        this.setSync("idle");
        logger.debug("sync", "Cola enviada");
      } catch (e) {
        logger.warn("sync", "Sin conexión con el servidor de datos", e);
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
        const remote = await this.backend.fetch();
        if (isDisabled(remote)) {
          this.markDisabled();
          this.setSync("local");
          return;
        }
        this.remoteMode = "on";
        const acc = { data: remote.accounts as unknown as Account[] };
        const cat = { data: remote.categories as unknown as Category[] };
        const tx = { data: remote.transactions as unknown as Transaction[] };
        const pk = { data: remote.pockets as unknown as Pocket[] };
        const bg = { data: remote.budgets as unknown as Budget[] };
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
        logger.debug("sync", "Datos actualizados desde el servidor", {
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
    const current = this.accounts[i];
    // Convertir una cuenta con historial en tarjeta (o al revés) reinterpreta ingresos/gastos
    // pasados como deuda: es lo que infló la deuda de tarjeta. Se exige crear una cuenta nueva.
    if (rest.type && (rest.type === "credit") !== (current.type === "credit") && this.hasMovements(id)) {
      logger.warn("store", "Cambio de tipo bloqueado: la cuenta tiene movimientos", { id, from: current.type, to: rest.type });
      return null;
    }
    this.accounts[i] = { ...current, ...rest };
    this.commit([this.op("accounts", this.accounts[i])]);
    await this.settle();
    return this.accounts[i];
  }

  /** true si algún movimiento usa la cuenta (origen o destino). */
  hasMovements(id: string): boolean {
    return this.transactions.some((t) => t.account_id === id || t.to_account_id === id);
  }

  async deleteAccount(id: string): Promise<boolean> {
    await this.ready();
    if (this.accounts.length <= 1) return false;
    if (this.hasMovements(id)) return false;
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
    // ADJUSTMENT: mueve el saldo pero no cuenta como ingreso/gasto del mes
    return this.addTransaction({
      type: "ADJUSTMENT",
      amount: Math.abs(diff),
      currency: acc.currency || "COP",
      description,
      account_id: accountId,
      to_account_id: diff > 0 ? accountId : null,
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
    // current_amount es derivado del historial: se ignora (usar transferToPocket o un gasto con pocket_id)
    const { current_amount: _derived, ...rest } = updates;
    this.pockets[i] = { ...this.pockets[i], ...rest };
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

  /** Aporta dinero de una cuenta a un bolsillo (el patrimonio total no cambia; el saldo del bolsillo se deriva). */
  async transferToPocket(pocketId: string, amount: number, accountId?: string): Promise<boolean> {
    await this.ready();
    const pocket = this.pockets.find((p) => p.id === pocketId);
    if (!pocket || !(amount > 0)) return false;
    const account =
      (accountId && this.accounts.find((a) => a.id === accountId)) ||
      this.accounts.find((a) => a.type !== "credit") ||
      this.accounts[0];

    const ops: OutboxOp[] = [];
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

  /** Devuelve un movimiento por id (null si no existe). */
  async getTransaction(id: string): Promise<Transaction | null> {
    await this.ready();
    return this.transactions.find((t) => t.id === id) || null;
  }

  /**
   * Edita un movimiento. Valida los cambios (lanza TxValidationError); commit() recalcula
   * los saldos de cuentas y bolsillos desde el historial (computeLedger).
   */
  async updateTransaction(id: string, updates: Partial<Transaction> | Record<string, unknown>): Promise<Transaction | null> {
    await this.ready();
    const i = this.transactions.findIndex((t) => t.id === id);
    if (i === -1) return null;
    const current = this.transactions[i];
    const { next, remote } = applyTxPatch(current, sanitizeTxUpdates(current, updates as Record<string, unknown>));

    if (next.account_id && !this.accounts.some((a) => a.id === next.account_id)) {
      throw new TxValidationError("La cuenta no existe");
    }
    if (next.to_account_id && !this.accounts.some((a) => a.id === next.to_account_id)) {
      throw new TxValidationError("La cuenta destino no existe");
    }
    if (next.pocket_id && next.pocket_id !== current.pocket_id && !this.pockets.some((p) => p.id === next.pocket_id)) {
      throw new TxValidationError("El bolsillo no existe");
    }

    const ops: OutboxOp[] = [this.op("transactions", remote)];
    this.transactions[i] = next;
    this.commit(ops);
    logger.info("store", "Movimiento editado", { id, campos: Object.keys(updates) });
    await this.settle();
    return next;
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
    // Saldos de cuentas y bolsillos se recalculan en commit()
    const ops: OutboxOp[] = [this.del("transactions", id)];
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
