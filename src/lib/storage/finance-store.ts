import { Account, Budget, Category, FinancialSummary, Pocket, Transaction } from "@/types/finance";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

// Clean zero-mock base categories
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

// Clean zero-balance accounts
const DEFAULT_ACCOUNTS: Account[] = [
  { id: "acc-main", name: "Cuenta Principal", type: "bank", balance: 0, currency: "COP" },
  { id: "acc-cash", name: "Billetera Efectivo", type: "cash", balance: 0, currency: "COP" },
  { id: "acc-savings", name: "Fondo de Ahorros", type: "savings", balance: 0, currency: "COP" },
];

class FinanceStore {
  private categories: Category[] = [...DEFAULT_CATEGORIES];
  private accounts: Account[] = [...DEFAULT_ACCOUNTS];
  private transactions: Transaction[] = []; // ZERO MOCK DATA
  private pockets: Pocket[] = []; // ZERO MOCK DATA
  private budgets: Budget[] = []; // ZERO MOCK DATA
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

      const storedPockets = localStorage.getItem("tafinance_pockets");
      if (storedPockets) this.pockets = JSON.parse(storedPockets);

      const storedBudgets = localStorage.getItem("tafinance_budgets");
      if (storedBudgets) this.budgets = JSON.parse(storedBudgets);
    } catch {
      // Fallback silently
    }
  }

  private saveToLocalStorage() {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem("tafinance_categories", JSON.stringify(this.categories));
      localStorage.setItem("tafinance_accounts", JSON.stringify(this.accounts));
      localStorage.setItem("tafinance_transactions", JSON.stringify(this.transactions));
      localStorage.setItem("tafinance_pockets", JSON.stringify(this.pockets));
      localStorage.setItem("tafinance_budgets", JSON.stringify(this.budgets));
    } catch {
      // ignore storage quota errors
    }
  }

  // --- ACCOUNTS ---
  async getAccounts(): Promise<Account[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("accounts").select("*");
        if (!error && data && data.length > 0) {
          this.accounts = data;
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
    }
    return this.accounts;
  }

  async updateAccountBalance(accountId: string, newBalance: number): Promise<boolean> {
    const acc = this.accounts.find((a) => a.id === accountId);
    if (!acc) return false;

    acc.balance = newBalance;
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from("accounts").update({ balance: newBalance }).eq("id", accountId);
      } catch {}
    }
    this.saveToLocalStorage();
    return true;
  }

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("categories").select("*");
        if (!error && data && data.length > 0) {
          this.categories = data;
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
    }
    return this.categories;
  }

  // --- POCKETS (BOLSILLOS) ---
  async getPockets(): Promise<Pocket[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("pockets").select("*");
        if (!error && data) {
          this.pockets = data;
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
    }
    return this.pockets;
  }

  async addPocket(pocket: Omit<Pocket, "id" | "created_at">): Promise<Pocket> {
    const newPocket: Pocket = {
      ...pocket,
      id: "pkt-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from("pockets")
          .insert([newPocket])
          .select()
          .single();
        if (!error && data) {
          this.pockets.push(data);
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
    }

    this.pockets.push(newPocket);
    this.saveToLocalStorage();
    return newPocket;
  }

  async createPocket(pocket: Omit<Pocket, "id" | "created_at">): Promise<Pocket> {
    return this.addPocket(pocket);
  }

  async updatePocket(id: string, updates: Partial<Pocket>): Promise<Pocket | null> {
    const index = this.pockets.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.pockets[index] = { ...this.pockets[index], ...updates };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from("pockets").update(updates).eq("id", id);
      } catch {}
    }

    this.saveToLocalStorage();
    return this.pockets[index];
  }

  async deletePocket(id: string): Promise<boolean> {
    const index = this.pockets.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.pockets.splice(index, 1);
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from("pockets").delete().eq("id", id);
      } catch {}
    }

    this.saveToLocalStorage();
    return true;
  }

  async transferToPocket(pocketId: string, amount: number, accountId?: string): Promise<boolean> {
    const pocket = this.pockets.find((p) => p.id === pocketId);
    if (!pocket) return false;

    // Deduct from account if specified
    const account = accountId ? this.accounts.find((a) => a.id === accountId) : this.accounts[0];
    if (account) {
      account.balance -= amount;
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from("accounts").update({ balance: account.balance }).eq("id", account.id);
        } catch {}
      }
    }

    pocket.current_amount += amount;
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from("pockets").update({ current_amount: pocket.current_amount }).eq("id", pocketId);
      } catch {}
    }

    // Record internal transfer transaction
    await this.addTransaction({
      type: "TRANSFER",
      amount,
      currency: "COP",
      description: `Aporte a bolsillo: ${pocket.name}`,
      pocket_id: pocketId,
      account_id: account?.id,
      date: new Date().toISOString().split("T")[0],
    });

    this.saveToLocalStorage();
    return true;
  }

  // --- TRANSACTIONS ---
  async getTransactions(): Promise<Transaction[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false });
        if (!error && data) {
          this.transactions = data;
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
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
        if (!error && data) {
          this.transactions.unshift(data);
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
    }

    // Update in-memory / local storage
    this.transactions.unshift(newTx);

    // Adjust account balance
    const account = this.accounts.find((a) => a.id === tx.account_id) || this.accounts[0];
    if (account) {
      if (tx.type === "INCOME") {
        account.balance += Number(tx.amount);
      } else if (tx.type === "EXPENSE") {
        account.balance -= Number(tx.amount);
      }
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from("accounts").update({ balance: account.balance }).eq("id", account.id);
        } catch {}
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
      } catch {}
    }

    // Revert balance
    const account = this.accounts.find((a) => a.id === tx.account_id) || this.accounts[0];
    if (account) {
      if (tx.type === "INCOME") {
        account.balance -= Number(tx.amount);
      } else if (tx.type === "EXPENSE") {
        account.balance += Number(tx.amount);
      }
      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from("accounts").update({ balance: account.balance }).eq("id", account.id);
        } catch {}
      }
    }

    this.transactions.splice(txIndex, 1);
    this.saveToLocalStorage();
    return true;
  }

  // --- BUDGETS ---
  async getBudgets(): Promise<Budget[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from("budgets").select("*");
        if (!error && data) {
          this.budgets = data;
          this.saveToLocalStorage();
          return data;
        }
      } catch {}
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
      } catch {}
    }

    this.saveToLocalStorage();
    return budget;
  }

  // --- SUMMARY CALCULATION ---
  async getSummary(targetMonth = new Date().toISOString().slice(0, 7)): Promise<FinancialSummary> {
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

    // Net worth history (clean points from real transactions)
    const netWorthHistory = [
      { date: "01", balance: totalBalance - monthlyIncome + monthlyExpenses },
      { date: "Hoy", balance: totalBalance },
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

  // --- DATA RESET & BACKUP ---
  async clearAllData(): Promise<boolean> {
    this.transactions = [];
    this.pockets = [];
    this.budgets = [];
    this.accounts = this.accounts.map((a) => ({ ...a, balance: 0 }));

    if (isSupabaseConfigured() && supabase) {
      try {
        await Promise.all([
          supabase.from("transactions").delete().neq("id", "none"),
          supabase.from("pockets").delete().neq("id", "none"),
          supabase.from("budgets").delete().neq("id", "none"),
          supabase.from("accounts").update({ balance: 0 }).neq("id", "none"),
        ]);
      } catch {}
    }

    if (this.isBrowser) {
      localStorage.removeItem("tafinance_transactions");
      localStorage.removeItem("tafinance_pockets");
      localStorage.removeItem("tafinance_budgets");
      localStorage.setItem("tafinance_accounts", JSON.stringify(this.accounts));
    }

    return true;
  }

  exportBackup(): any {
    return {
      version: "2.0.0",
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
