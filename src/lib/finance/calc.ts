import {
  Account,
  Budget,
  Category,
  FinancialSummary,
  Pocket,
  Reminder,
  Transaction,
} from "@/types/finance";

/* ------------------------------------------------------------------ */
/* Fechas (siempre en hora local: evita el desfase UTC de toISOString)  */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha de hoy. En el servidor (UTC) se usa la zona horaria de la app para no adelantar el día. */
export function todayStr(): string {
  if (typeof window === "undefined") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: process.env.APP_TIMEZONE || "America/Bogota",
    }).format(new Date());
  }
  return toDateStr(new Date());
}

export function monthKey(d?: Date | string): string {
  if (d === undefined) return todayStr().slice(0, 7);
  if (typeof d === "string") return d.slice(0, 7);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return r;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
    new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return Math.round(ms / 86400000);
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

/** Fecha con ese día del mes (ajustado al último día si el mes es más corto). */
function dateWithDay(y: number, m0: number, day: number): Date {
  return new Date(y, m0, Math.min(day, daysInMonth(y, m0)));
}

/** Primera fecha >= `from` cuyo día del mes es `day`. */
export function nextOccurrenceOnOrAfter(from: Date, day: number): Date {
  const cand = dateWithDay(from.getFullYear(), from.getMonth(), day);
  if (cand >= new Date(from.getFullYear(), from.getMonth(), from.getDate())) return cand;
  return dateWithDay(from.getFullYear(), from.getMonth() + 1, day);
}

/** Primera fecha estrictamente > `from` cuyo día del mes es `day`. */
export function nextOccurrenceAfter(from: Date, day: number): Date {
  return nextOccurrenceOnOrAfter(addDays(from, 1), day);
}

/** Última fecha <= `from` cuyo día del mes es `day`. */
export function lastOccurrenceOnOrBefore(from: Date, day: number): Date {
  const cand = dateWithDay(from.getFullYear(), from.getMonth(), day);
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (cand <= f) return cand;
  return dateWithDay(from.getFullYear(), from.getMonth() - 1, day);
}

/* ------------------------------------------------------------------ */
/* Saldos derivados de las transacciones (fuente única de verdad)       */
/* ------------------------------------------------------------------ */

/** Descripciones que usaban versiones anteriores para los ajustes (antes eran INCOME/EXPENSE). */
const LEGACY_ADJUSTMENT_DESCRIPTIONS = new Set(["Ajuste de saldo", "Saldo inicial"]);

/**
 * Un ajuste corrige el saldo de una cuenta pero no es un ingreso ni un gasto real.
 * Incluye los ajustes antiguos guardados como INCOME/EXPENSE sin categoría.
 */
export function isAdjustment(t: Transaction): boolean {
  if (t.type === "ADJUSTMENT") return true;
  return (
    (t.type === "INCOME" || t.type === "EXPENSE") &&
    !t.category_id &&
    LEGACY_ADJUSTMENT_DESCRIPTIONS.has(t.description)
  );
}

/** Ingreso o gasto real (excluye ajustes y transferencias): lo que cuentan resumen, categorías y presupuestos. */
export const isRealIncome = (t: Transaction) => t.type === "INCOME" && !isAdjustment(t);
export const isRealExpense = (t: Transaction) => t.type === "EXPENSE" && !isAdjustment(t);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Orden cronológico estable (fecha, luego creación). */
function chronological(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    a.date === b.date ? (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) : a.date < b.date ? -1 : 1
  );
}

export interface Ledger {
  accounts: Account[];
  pockets: Pocket[];
}

/**
 * Saldos de cuentas Y bolsillos derivados del historial, con reglas únicas:
 * - INCOME / EXPENSE: suman / restan a `account_id`.
 * - EXPENSE con bolsillo existente: el bolsillo paga hasta su saldo; el resto sale de la cuenta.
 * - TRANSFER entre cuentas: `account_id` → `to_account_id`.
 * - TRANSFER con bolsillo: cuenta → bolsillo (aporte) o bolsillo → `to_account_id` (retiro).
 * - TRANSFER huérfana (bolsillo borrado, sin destino): no mueve dinero; así borrar un bolsillo
 *   devuelve su saldo a la cuenta de origen en vez de hacerlo desaparecer.
 * - ADJUSTMENT: entra a `to_account_id` o sale de `account_id`.
 */
export function computeLedger(accounts: Account[], txs: Transaction[], pockets: Pocket[] = []): Ledger {
  const acc = new Map<string, number>();
  accounts.forEach((a) => acc.set(a.id, 0));
  const pk = new Map<string, number>();
  pockets.forEach((p) => pk.set(p.id, 0));
  const fallback = accounts.find((a) => a.type !== "credit")?.id ?? accounts[0]?.id;

  const apply = (id: string | undefined | null, delta: number) => {
    const key = id && acc.has(id) ? id : fallback;
    if (!key) return;
    acc.set(key, (acc.get(key) || 0) + delta);
  };
  const pocketOf = (t: Transaction) => (t.pocket_id && pk.has(t.pocket_id) ? t.pocket_id : null);

  for (const t of chronological(txs)) {
    const amt = Number(t.amount) || 0;
    if (amt <= 0) continue;
    const pocket = pocketOf(t);
    switch (t.type) {
      case "INCOME":
        apply(t.account_id, amt);
        break;
      case "EXPENSE": {
        if (pocket && !isAdjustment(t)) {
          const covered = Math.min(amt, Math.max(0, pk.get(pocket) || 0));
          pk.set(pocket, (pk.get(pocket) || 0) - covered);
          if (amt - covered > 0) apply(t.account_id, -(amt - covered));
        } else {
          apply(t.account_id, -amt);
        }
        break;
      }
      case "TRANSFER":
        if (t.pocket_id) {
          if (!pocket) break; // bolsillo borrado: el aporte vuelve a la cuenta
          if (t.to_account_id) {
            pk.set(pocket, (pk.get(pocket) || 0) - amt);
            apply(t.to_account_id, amt);
          } else {
            apply(t.account_id, -amt);
            pk.set(pocket, (pk.get(pocket) || 0) + amt);
          }
        } else if (t.to_account_id) {
          apply(t.account_id, -amt);
          apply(t.to_account_id, amt);
        }
        break;
      case "ADJUSTMENT":
        if (t.to_account_id) apply(t.to_account_id, amt);
        else apply(t.account_id, -amt);
        break;
    }
  }
  return {
    accounts: accounts.map((a) => ({ ...a, balance: round2(acc.get(a.id) || 0) })),
    pockets: pockets.map((p) => ({ ...p, current_amount: round2(pk.get(p.id) || 0) })),
  };
}

export function computeBalances(accounts: Account[], txs: Transaction[], pockets: Pocket[] = []): Account[] {
  return computeLedger(accounts, txs, pockets).accounts;
}

/** Efecto neto de una transacción sobre el patrimonio (transferencias = internas; ajustes sí cuentan). */
function netWorthEffect(t: Transaction): number {
  const amt = Number(t.amount) || 0;
  switch (t.type) {
    case "INCOME":
      return amt;
    case "EXPENSE":
      return -amt;
    case "ADJUSTMENT":
      return t.to_account_id ? amt : -amt;
    default:
      return 0;
  }
}

export function netWorth(accounts: Account[], pockets: Pocket[]): number {
  return (
    accounts.reduce((s, a) => s + Number(a.balance), 0) +
    pockets.reduce((s, p) => s + Number(p.current_amount || 0), 0)
  );
}

/**
 * Convierte texto de monto a número aceptando formato colombiano y anglosajón:
 * "200.000" → 200000, "1.250.000,50" → 1250000.5, "200,000" → 200000, "$ 35.900" → 35900, "12.5" → 12.5.
 * Un único separador seguido de exactamente 3 dígitos se trata como separador de miles.
 */
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  if (!input) return NaN;
  let s = String(input).replace(/[^\d.,-]/g, "");
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (!s) return NaN;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // El separador que aparece último es el decimal
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    normalized = s.split(thou).join("").replace(dec, ".");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const parts = s.split(sep);
    const isThousands = parts.length > 2 || parts[parts.length - 1].length === 3;
    normalized = isThousands ? parts.join("") : parts.join(".");
  } else {
    normalized = s;
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

/**
 * Totales coherentes entre vistas: patrimonio = disponible + bolsillos − deuda.
 * El saldo a favor de una tarjeta cuenta como disponible, no como deuda negativa.
 */
export function accountTotals(accounts: Account[]): { available: number; debt: number } {
  let available = 0;
  let debt = 0;
  for (const a of accounts) {
    const b = Number(a.balance) || 0;
    if (a.type === "credit" && b < 0) debt += -b;
    else available += b;
  }
  return { available: round2(available), debt: round2(debt) };
}

/* ------------------------------------------------------------------ */
/* Resumen mensual                                                      */
/* ------------------------------------------------------------------ */

export function buildSummary(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  budgets: Budget[],
  pockets: Pocket[],
  targetMonth: string = monthKey()
): FinancialSummary {
  const nowTotal = netWorth(accounts, pockets);
  const pocketsTotal = pockets.reduce((s, p) => s + Number(p.current_amount || 0), 0);
  const { available: availableBalance, debt: creditDebt } = accountTotals(accounts);

  const monthTxs = transactions.filter((t) => t.date.startsWith(targetMonth));
  const monthlyIncome = monthTxs.filter(isRealIncome).reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpenses = monthTxs.filter(isRealExpense).reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate =
    monthlyIncome > 0 ? Math.max(0, ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

  // Patrimonio al cierre / apertura del mes consultado
  const [y, m] = targetMonth.split("-").map(Number);
  const monthEnd = toDateStr(new Date(y, m, 0));
  const monthStart = `${targetMonth}-01`;
  const afterEnd = transactions.filter((t) => t.date > monthEnd).reduce((s, t) => s + netWorthEffect(t), 0);
  const closingBalance = nowTotal - afterEnd;
  const fromStart = transactions.filter((t) => t.date >= monthStart).reduce((s, t) => s + netWorthEffect(t), 0);
  const openingBalance = nowTotal - fromStart;

  const categoryTotals: Record<string, number> = {};
  for (const t of monthTxs) {
    if (isRealExpense(t)) {
      const key = t.category_id || "__none";
      categoryTotals[key] = (categoryTotals[key] || 0) + Number(t.amount);
    }
  }

  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([catId, total]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || "Sin categoría",
        color: cat?.color || "#94A3B8",
        icon: cat?.icon || "Circle",
        total,
        percentage: monthlyExpenses > 0 ? (total / monthlyExpenses) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  const budgetStatus = budgets
    .filter((b) => b.month === targetMonth)
    .map((b) => {
      const cat = categories.find((c) => c.id === b.category_id);
      const spent = categoryTotals[b.category_id] || 0;
      const limit = Number(b.monthly_limit) || 0;
      return {
        categoryId: b.category_id,
        categoryName: cat?.name || "Presupuesto",
        spent,
        limit,
        percentage: limit > 0 ? Math.min(100, (spent / limit) * 100) : 0,
      };
    });

  return {
    totalBalance: nowTotal,
    availableBalance,
    pocketsTotal,
    creditDebt,
    month: targetMonth,
    openingBalance,
    closingBalance,
    netFlow: monthlyIncome - monthlyExpenses,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    netWorthHistory: buildHistory(nowTotal, transactions, 30),
    categoryBreakdown,
    budgetStatus,
  };
}

/** Serie diaria del patrimonio para los últimos `days` días (termina hoy). */
export function buildHistory(
  nowTotal: number,
  transactions: Transaction[],
  days: number
): { date: string; balance: number }[] {
  const today = new Date();
  const out: { date: string; balance: number }[] = [];
  // net por fecha
  const byDate = new Map<string, number>();
  for (const t of transactions) {
    const eff = netWorthEffect(t);
    if (eff) byDate.set(t.date, (byDate.get(t.date) || 0) + eff);
  }
  const futureAfterToday = [...byDate.entries()]
    .filter(([d]) => d > toDateStr(today))
    .reduce((s, [, v]) => s + v, 0);

  let running = nowTotal - futureAfterToday; // saldo al final de hoy
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    out.unshift({ date: pad(d.getDate()) + "/" + pad(d.getMonth() + 1), balance: running });
    running -= byDate.get(toDateStr(d)) || 0;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tarjetas de crédito                                                  */
/* ------------------------------------------------------------------ */

export interface CardStatus {
  card: Account;
  debt: number;
  billed: number;
  unbilled: number;
  lastCutoff: Date | null;
  nextCutoff: Date | null;
  nextDue: Date | null;
  daysToCutoff: number | null;
  daysToDue: number | null;
  /** Rentabilidad estimada por mantener el dinero invertido hasta la fecha de pago. */
  floatYield: number;
  avgFloatDays: number;
}

export function cardStatus(card: Account, transactions: Transaction[], now = new Date()): CardStatus {
  const debt = Math.max(0, -Number(card.balance));
  const cutoff = card.cutoff_day || null;
  const due = card.due_day || null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let lastCutoff: Date | null = null;
  let nextCutoff: Date | null = null;
  let nextDue: Date | null = null;
  let billed = 0;
  let unbilled = debt;

  const charges = transactions
    .filter((t) => isRealExpense(t) && t.account_id === card.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (cutoff) {
    lastCutoff = lastOccurrenceOnOrBefore(today, cutoff);
    nextCutoff = nextOccurrenceOnOrAfter(today, cutoff);
    const lastStr = toDateStr(lastCutoff);
    const afterCutoff = charges
      .filter((t) => t.date > lastStr)
      .reduce((s, t) => s + Number(t.amount), 0);
    unbilled = Math.min(debt, afterCutoff);
    billed = Math.max(0, debt - unbilled);
    if (due) {
      const billedDue = nextOccurrenceAfter(lastCutoff, due);
      // Si hay extracto cerrado pendiente y su vencimiento no pasó, ese es el próximo pago
      nextDue = billed > 0 && billedDue >= today ? billedDue : nextOccurrenceAfter(nextCutoff, due);
    }
  } else if (due) {
    nextDue = nextOccurrenceOnOrAfter(today, due);
    billed = debt;
    unbilled = 0;
  }

  // Rentabilidad de los días de financiación sobre la deuda abierta (más recientes primero)
  let remaining = debt;
  let floatYield = 0;
  let weightedDays = 0;
  let weightedAmt = 0;
  const yieldRate = Number(card.annual_yield) || 0;
  if (cutoff && due) {
    for (const t of charges) {
      if (remaining <= 0) break;
      const amt = Math.min(remaining, Number(t.amount));
      remaining -= amt;
      const p = parseDate(t.date);
      const cutAfter = nextOccurrenceOnOrAfter(p, cutoff);
      const dueDate = nextOccurrenceAfter(cutAfter, due);
      const days = Math.max(0, daysBetween(p, dueDate));
      weightedDays += days * amt;
      weightedAmt += amt;
      floatYield += amt * (Math.pow(1 + yieldRate / 100, days / 365) - 1);
    }
  }

  return {
    card,
    debt,
    billed,
    unbilled,
    lastCutoff,
    nextCutoff,
    nextDue,
    daysToCutoff: nextCutoff ? daysBetween(today, nextCutoff) : null,
    daysToDue: nextDue ? daysBetween(today, nextDue) : null,
    floatYield: Math.round(floatYield),
    avgFloatDays: weightedAmt > 0 ? Math.round(weightedDays / weightedAmt) : 0,
  };
}

/** Días de financiación que obtendría una compra realizada en `purchase` con esa tarjeta. */
export function floatDaysFor(card: Account, purchase: Date): number | null {
  if (!card.cutoff_day || !card.due_day) return null;
  const cutAfter = nextOccurrenceOnOrAfter(purchase, card.cutoff_day);
  const dueDate = nextOccurrenceAfter(cutAfter, card.due_day);
  return Math.max(0, daysBetween(purchase, dueDate));
}

/* ------------------------------------------------------------------ */
/* Compromisos recurrentes                                              */
/* ------------------------------------------------------------------ */

export function advanceByInterval(date: Date, interval: Transaction["recurrence_interval"]): Date {
  switch (interval) {
    case "WEEKLY":
      return addDays(date, 7);
    case "BIWEEKLY":
      return addDays(date, 14);
    case "YEARLY":
      return dateWithDay(date.getFullYear() + 1, date.getMonth(), date.getDate());
    case "MONTHLY":
    default:
      return dateWithDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
}

export interface UpcomingItem {
  id: string;
  kind: "recurring" | "card_due" | "card_cutoff";
  title: string;
  dueDate: string;
  daysLeft: number;
  amount?: number;
  type?: Transaction["type"];
  txId?: string;
  accountId?: string;
  overdue: boolean;
}

export function upcomingRecurring(transactions: Transaction[], now = new Date()): UpcomingItem[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return transactions
    .filter((t) => t.is_recurring && (isRealIncome(t) || isRealExpense(t)))
    .map((t) => {
      const next = advanceByInterval(parseDate(t.date), t.recurrence_interval);
      const daysLeft = daysBetween(today, next);
      return {
        id: `rec-${t.id}`,
        kind: "recurring" as const,
        title: t.merchant || t.description,
        dueDate: toDateStr(next),
        daysLeft,
        amount: Number(t.amount),
        type: t.type,
        txId: t.id,
        overdue: daysLeft < 0,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function upcomingItems(
  accounts: Account[],
  transactions: Transaction[],
  now = new Date()
): UpcomingItem[] {
  const items: UpcomingItem[] = upcomingRecurring(transactions, now);
  for (const card of accounts.filter((a) => a.type === "credit")) {
    const st = cardStatus(card, transactions, now);
    if (st.nextDue && st.daysToDue !== null && (st.billed > 0 || st.debt > 0)) {
      items.push({
        id: `due-${card.id}`,
        kind: "card_due",
        title: `Pagar ${card.name}`,
        dueDate: toDateStr(st.nextDue),
        daysLeft: st.daysToDue,
        amount: st.billed > 0 ? st.billed : st.debt,
        accountId: card.id,
        overdue: st.daysToDue < 0,
      });
    }
    if (st.nextCutoff && st.daysToCutoff !== null) {
      items.push({
        id: `cut-${card.id}`,
        kind: "card_cutoff",
        title: `Corte ${card.name}`,
        dueDate: toDateStr(st.nextCutoff),
        daysLeft: st.daysToCutoff,
        amount: st.unbilled,
        accountId: card.id,
        overdue: false,
      });
    }
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ------------------------------------------------------------------ */
/* Recordatorios programables (para notificaciones locales y push)      */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function at8(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0).toISOString();
}

export function buildReminders(
  accounts: Account[],
  transactions: Transaction[],
  horizonDays = 45,
  now = new Date()
): Reminder[] {
  const out: Reminder[] = [];
  const limit = addDays(now, horizonDays);

  for (const card of accounts.filter((a) => a.type === "credit")) {
    const st = cardStatus(card, transactions, now);
    const before = Math.max(0, Number(card.remind_days_before ?? 1));

    if (st.nextCutoff && st.nextCutoff <= limit) {
      out.push({
        id: `cut-${card.id}-${toDateStr(st.nextCutoff)}`,
        kind: "card_cutoff",
        title: `Corte de ${card.name}`,
        body: `Hoy cierra el extracto. Llevas ${fmt(st.unbilled)} en compras del ciclo.`,
        dueDate: toDateStr(st.nextCutoff),
        fireAt: at8(st.nextCutoff),
        amount: st.unbilled,
        accountId: card.id,
      });
    }
    if (st.nextDue && st.nextDue <= limit && st.debt > 0) {
      const fire = addDays(st.nextDue, -before);
      out.push({
        id: `due-${card.id}-${toDateStr(st.nextDue)}`,
        kind: "card_due",
        title: before === 0 ? `Hoy vence ${card.name}` : `${before === 1 ? "Mañana" : `En ${before} días`} vence ${card.name}`,
        body: `Paga ${fmt(st.billed > 0 ? st.billed : st.debt)} antes del ${toDateStr(st.nextDue)}. Hasta entonces tu dinero puede seguir rentando.`,
        dueDate: toDateStr(st.nextDue),
        fireAt: at8(fire),
        amount: st.billed > 0 ? st.billed : st.debt,
        accountId: card.id,
      });
    }
  }

  for (const r of upcomingRecurring(transactions, now)) {
    if (r.type !== "EXPENSE") continue;
    const due = parseDate(r.dueDate);
    if (due > limit) continue;
    out.push({
      id: `${r.id}-${r.dueDate}`,
      kind: "recurring",
      title: `Pago próximo: ${r.title}`,
      body: `${fmt(r.amount || 0)} vence el ${r.dueDate}.`,
      dueDate: r.dueDate,
      fireAt: at8(addDays(due, -1)),
      amount: r.amount,
      txId: r.txId,
    });
  }

  return out.sort((a, b) => (a.fireAt < b.fireAt ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* Categorías: mapeo de nombres de IA a categorías reales               */
/* ------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const KEYWORD_TO_CATEGORY_ID: [RegExp, string][] = [
  [/(spotify|netflix|disney|hbo|prime|youtube|suscrip|apple|google|icloud|chatgpt|claude|digital|software|app )/, "cat-subscriptions"],
  [/(uber|didi|cabify|taxi|gasolina|combustible|peaje|transporte|pasaje|bus|metro|transmilenio|vuelo|movilidad)/, "cat-transport"],
  [/(arriendo|alquiler|luz|agua|gas|internet|claro|tigo|movistar|administracion|servicios|vivienda|hogar|condominio)/, "cat-home"],
  [/(medic|doctor|farmacia|drogueria|salud|eps|bienestar|cuidado|gimnasio)/, "cat-health"],
  [/(restaurante|cine|bar |fiesta|trago|cerveza|ocio|cafe|pizza|hamburguesa|jugo|helado|domicilio|rappi|compras|ropa|zara)/, "cat-leisure"],
  [/(mercado|supermercado|alimentacion|comida|almuerzo|cena|desayuno|exito|jumbo|d1|olimpica|carulla|ara )/, "cat-food"],
  [/(nomina|salario|sueldo|quincena)/, "cat-salary"],
  [/(freelance|honorarios|venta|extra|ingreso|cobro|consign)/, "cat-freelance"],
];

const AI_NAME_TO_ID: Record<string, string> = {
  "alimentacion restaurantes": "cat-food",
  "transporte gasolina": "cat-transport",
  "suscripciones ocio": "cat-subscriptions",
  "servicios publicos hogar": "cat-home",
  "compras ropa": "cat-leisure",
  "salud cuidado": "cat-health",
  "salario nomina": "cat-salary",
  "ingresos extra freelance": "cat-freelance",
};

/**
 * Encuentra la categoría real a partir del nombre que sugiere la IA / el parser local.
 * Prioridad: nombre exacto → alias conocido → palabras clave del contexto → tokens → primera del tipo.
 */
export function matchCategory(
  categories: Category[],
  suggested: string,
  type: Transaction["type"],
  context = ""
): Category | undefined {
  const kind = type === "INCOME" ? "INCOME" : "EXPENSE";
  const pool = categories.filter((c) => c.type === kind);
  if (pool.length === 0) return categories[0];

  const target = norm(suggested);
  const exact = pool.find((c) => norm(c.name) === target);
  if (exact) return exact;

  const aliasId = AI_NAME_TO_ID[target];
  const byContext = (() => {
    const haystack = norm(context) + " ";
    for (const [re, id] of KEYWORD_TO_CATEGORY_ID) {
      if (re.test(haystack)) {
        const found = pool.find((c) => c.id === id);
        if (found) return found;
      }
    }
    return undefined;
  })();

  // Si el contexto (p. ej. "Spotify") apunta a una categoría concreta, gana sobre el alias genérico
  if (byContext) return byContext;
  if (aliasId) {
    const found = pool.find((c) => c.id === aliasId);
    if (found) return found;
  }

  const tokens = target.split(" ").filter((t) => t.length > 3);
  let best: { c: Category; score: number } | null = null;
  for (const c of pool) {
    const name = norm(c.name);
    const score = tokens.filter((t) => name.includes(t)).length;
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best ? best.c : pool[0];
}
