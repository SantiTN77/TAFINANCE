import { Account, Budget, Category, FinancialSummary, Transaction } from "@/types/finance";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

// Initial seed data for offline / local-first experience
const INITIAL_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Alimentación & Restaurantes", icon: "Utensils", color: "#10B981", type: "EXPENSE" },
  { id: "cat-2", name: "Transporte & Gasolina", icon: "Car", color: "#06B6D4", type: "EXPENSE" },
  { id: "cat-3", name: "Suscripciones & Ocio", icon: "Sparkles", color: "#8B5CF6", type: "EXPENSE" },
  { id: "cat-4", name: "Servicios Públicos & Hogar", icon: "Zap", color: "#F59E0B", type: "EXPENSE" },
  { id: "cat-5", name: "Compras & Ropa", icon: "ShoppingBag", color: "#EC4899", type: "EXPENSE" },
  { id: "cat-6", name: "Salud & Cuidado", icon: "HeartPulse", color: "#EF4444", type: "EXPENSE" },
  { id: "cat-7", name: "Salario & Nómina", icon: "Briefcase", color: "#10B981", type: "INCOME" },
  { id: "cat-8", name: "Ingresos Extra & Freelance", icon: "TrendingUp", color: "#06B6D4", type: "INCOME" },
];

const INITIAL_ACCOUNTS: Account[] = [
  { id: "acc-1", name: "Cuenta Principal", type: "bank", balance: 2450000, currency: "COP" },
  { id: "acc-2", name: "Billetera Efectivo", type: "cash", balance: 120000, currency: "COP" },
  { id: "acc-3", name: "Fondo de Ahorros", type: "savings", balance: 1500000, currency: "COP" },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    account_id: "acc-1",
    category_id: "cat-7",
    type: "INCOME",
    amount: 3200000,
    currency: "COP",
    description: "Pago de nómina quincenal",
    merchant: "Empresa",
    date: "2026-10-01",
    created_at: new Date("2026-10-01T08:00:00Z").toISOString(),
  },
  {
    id: "tx-2",
    account_id: "acc-1",
    category_id: "cat-3",
    type: "EXPENSE",
    amount: 30000,
    currency: "COP",
    description: "Spotify Premium Mensual",
    merchant: "Spotify",
    date: "2026-10-02",
    created_at: new Date("2026-10-02T12:00:00Z").toISOString(),
  },
  {
    id: "tx-3",
    account_id: "acc-2",
    category_id: "cat-1",
    type: "EXPENSE",
    amount: 45000,
    currency: "COP",
    description: "Comida con amigos",
    merchant: "Restaurante Bistro",
    raw_prompt: "Gasté 45 mil en comida amigos",
    date: "2026-10-02",
    created_at: new Date("2026-10-02T19:30:00Z").toISOString(),
  },
];

const INITIAL_BUDGETS: Budget[] = [
  { id: "b-1", category_id: "cat-1", monthly_limit: 600000, month: "2026-10" },
  { id: "b-2", category_id: "cat-2", monthly_limit: 250000, month: "2026-10" },
  { id: "b-3", category_id: "cat-3", monthly_limit: 150000, month: "2026-10" },
  { id: "b-4", category_id: "cat-4", monthly_limit: 300000, month: "2026-10" },
];

class FinanceStore {
  private categories: Category[] = [...INITIAL_CATEGORIES];
  private accounts: Account[] = [...INITIAL_ACCOUNTS];
  private transactions: Transaction[] = [...INITIAL_TRANSACTIONS];
  private budgets: Budget[] = [...INITIAL_BUDGETS];
  private isBrowser: boolean = typeof window !== "undefined";

  constructor() {
    if (this.isBrowser) {
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage() {
    try {
      const storedCategories = localStorage.getItem("tafinance_categories");
      if (storedCategories) this.categories = JSON.parse(storedCategories);

      const storedAccounts = localStorage.getItem("tafinance_accounts");
      if (storedAccounts) this.accounts = JSON.parse(storedAccounts);

      const storedTransactions = localStorage.getItem("tafinance_transactions");
      if (storedTransactions) this.transactions = JSON.parse(storedTransactions);

      const storedBudgets = localStorage.getItem("tafinance_budgets");
      if (storedBudgets) this.budgets = JSON.parse(storedBudgets);
    } catch {
      // Fallback silently to initial in-memory
    }
  }

  private saveToLocalStorage() {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem("tafinance_categories", JSON.stringify(this.categories));
      localStorage.setItem("tafinance_accounts", JSON.stringify(this.accounts));
      localStorage.setItem("tafinance_transactions", JSON.stringify(this.transactions));
      localStorage.setItem("tafinance_budgets", JSON.stringify(this.budgets));
    } catch {
      // ignore storage quota errors
    }
  }

  async getAccounts(): Promise<Account[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("accounts").select("*");
        if (!error && data && data.length > 0) return data;
      } catch {
        // Fallback
      }
    }
    return this.accounts;
  }

  async getCategories(): Promise<Category[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("categories").select("*");
        if (!error && data && data.length > 0) return data;
      } catch {
        // Fallback
      }
    }
    return this.categories;
  }

  async getTransactions(): Promise<Transaction[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false });
        if (!error && data) return data;
      } catch {
        // Fallback
      }
    }
    return [...this.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async addTransaction(
    tx: Omit<Transaction, "id" | "created_at">
  ): Promise<Transaction> {
    const newTx: Transaction = {
      ...tx,
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .insert([newTx])
          .select()
          .single();
        if (!error && data) return data;
      } catch {
        // Fallback
      }
    }

    // Update in-memory / local storage
    this.transactions.unshift(newTx);

    // Adjust account balance
    const account = this.accounts.find((a) => a.id === tx.account_id) || this.accounts[0];
    if (account) {
      if (tx.type === "INCOME") {
        account.balance += tx.amount;
      } else if (tx.type === "EXPENSE") {
        account.balance -= tx.amount;
      }
    }

    this.saveToLocalStorage();
    return newTx;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const txIndex = this.transactions.findIndex((t) => t.id === id);
    if (txIndex === -1) return false;

    const tx = this.transactions[txIndex];

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from("transactions").delete().eq("id", id);
      } catch {
        // Fallback
      }
    }

    // Revert balance
    const account = this.accounts.find((a) => a.id === tx.account_id) || this.accounts[0];
    if (account) {
      if (tx.type === "INCOME") {
        account.balance -= tx.amount;
      } else if (tx.type === "EXPENSE") {
        account.balance += tx.amount;
      }
    }

    this.transactions.splice(txIndex, 1);
    this.saveToLocalStorage();
    return true;
  }

  async getBudgets(): Promise<Budget[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("budgets").select("*");
        if (!error && data) return data;
      } catch {
        // Fallback
      }
    }
    return this.budgets;
  }

  async setBudget(categoryId: string, monthlyLimit: number, month: string): Promise<Budget> {
    const existingIndex = this.budgets.findIndex(
      (b) => b.category_id === categoryId && b.month === month
    );

    let budget: Budget;
    if (existingIndex >= 0) {
      this.budgets[existingIndex].monthly_limit = monthlyLimit;
      budget = this.budgets[existingIndex];
    } else {
      budget = {
        id: "b-" + Date.now(),
        category_id: categoryId,
        monthly_limit: monthlyLimit,
        month,
      };
      this.budgets.push(budget);
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from("budgets").upsert([budget]);
      } catch {
        // Fallback
      }
    }

    this.saveToLocalStorage();
    return budget;
  }

  async getSummary(targetMonth = "2026-10"): Promise<FinancialSummary> {
    const [accounts, categories, transactions, budgets] = await Promise.all([
      this.getAccounts(),
      this.getCategories(),
      this.getTransactions(),
      this.getBudgets(),
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const monthTxs = transactions.filter((t) => t.date.startsWith(targetMonth));
    const monthlyIncome = monthTxs
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const monthlyExpenses = monthTxs
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const savingsRate =
      monthlyIncome > 0 ? Math.max(0, ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const t of monthTxs) {
      if (t.type === "EXPENSE" && t.category_id) {
        categoryTotals[t.category_id] = (categoryTotals[t.category_id] || 0) + Number(t.amount);
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals).map(([catId, total]) => {
      const cat = categories.find((c) => c.id === catId);
      return {
        categoryId: catId,
        categoryName: cat?.name || "Otros",
        color: cat?.color || "#94A3B8",
        icon: cat?.icon || "Circle",
        total,
        percentage: monthlyExpenses > 0 ? (total / monthlyExpenses) * 100 : 0,
      };
    });

    // Budget status
    const currentMonthBudgets = budgets.filter((b) => b.month === targetMonth);
    const budgetStatus = currentMonthBudgets.map((b) => {
      const cat = categories.find((c) => c.id === b.category_id);
      const spent = categoryTotals[b.category_id] || 0;
      return {
        categoryId: b.category_id,
        categoryName: cat?.name || "Presupuesto",
        spent,
        limit: Number(b.monthly_limit),
        percentage: Math.min(100, (spent / Number(b.monthly_limit)) * 100),
      };
    });

    // 7-day timeline net worth trend
    const netWorthHistory = [
      { date: "26 Sep", balance: totalBalance - monthlyIncome * 0.4 + monthlyExpenses * 0.3 },
      { date: "28 Sep", balance: totalBalance - monthlyIncome * 0.2 + monthlyExpenses * 0.2 },
      { date: "30 Sep", balance: totalBalance - monthlyIncome * 0.1 + monthlyExpenses * 0.1 },
      { date: "01 Oct", balance: totalBalance - 45000 },
      { date: "02 Oct", balance: totalBalance },
    ];

    return {
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      savingsRate,
      netWorthHistory,
      categoryBreakdown,
      budgetStatus,
    };
  }
}

export const financeStore = new FinanceStore();
