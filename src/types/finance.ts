export type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";

export interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "credit" | "savings";
  balance: number;
  currency: string;
  /** Solo tarjetas de crédito: día del mes en que cierra el extracto (corte). */
  cutoff_day?: number | null;
  /** Solo tarjetas de crédito: día del mes límite de pago. */
  due_day?: number | null;
  /** Rentabilidad anual (E.A. %) con la que se estima el rendimiento de los días de financiación. */
  annual_yield?: number | null;
  /** Días antes del vencimiento para avisar el pago (por defecto 1). */
  remind_days_before?: number | null;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "EXPENSE" | "INCOME";
}

export interface Pocket {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  icon: string;
  color: string;
  category: string;
  auto_save_percentage?: number;
  created_at?: string;
}

export interface FixedCommitment {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  isPaid?: boolean;
}

export interface Transaction {
  id: string;
  account_id?: string;
  category_id?: string;
  pocket_id?: string;
  /** Solo TRANSFER entre cuentas (ej. pago de tarjeta): cuenta destino. */
  to_account_id?: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  merchant?: string;
  receipt_url?: string;
  raw_prompt?: string;
  is_recurring?: boolean;
  recurrence_interval?: "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "YEARLY";
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Budget {
  id: string;
  category_id: string;
  monthly_limit: number;
  month: string; // YYYY-MM
}

export interface UserSettings {
  id: string;
  theme: "dark" | "light";
  language: "es" | "en";
  currency: "COP" | "USD" | "EUR";
  pure_black_oled: boolean;
  auto_pilot: boolean;
  updated_at?: string;
}

export interface FinancialSummary {
  /** Patrimonio neto: cuentas (con deuda de tarjetas) + bolsillos. */
  totalBalance: number;
  /** Dinero en cuentas no crédito. */
  availableBalance?: number;
  /** Dinero apartado en bolsillos. */
  pocketsTotal?: number;
  /** Deuda total en tarjetas de crédito (positiva). */
  creditDebt?: number;
  month?: string;
  openingBalance?: number;
  closingBalance?: number;
  netFlow?: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  netWorthHistory: { date: string; balance: number }[];
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    color: string;
    icon: string;
    total: number;
    percentage: number;
  }[];
  budgetStatus: {
    categoryId: string;
    categoryName: string;
    spent: number;
    limit: number;
    percentage: number;
  }[];
}

export interface ParsedVoiceTransaction {
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  description: string;
  merchant?: string;
  date?: string;
  confidence?: number;
}

export interface ScannedReceipt {
  merchant: string;
  date: string;
  total: number;
  currency: string;
  tax?: number;
  category: string;
  items: {
    name: string;
    price: number;
    quantity?: number;
  }[];
}

export type ReminderKind = "card_cutoff" | "card_due" | "recurring";

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** Fecha del evento (YYYY-MM-DD). */
  dueDate: string;
  /** Instante ISO en que debe notificarse. */
  fireAt: string;
  amount?: number;
  accountId?: string;
  txId?: string;
}
