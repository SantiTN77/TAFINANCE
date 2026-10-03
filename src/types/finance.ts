export type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";

export interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "credit" | "savings";
  balance: number;
  currency: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "EXPENSE" | "INCOME";
}

export interface Transaction {
  id: string;
  account_id?: string;
  category_id?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  merchant?: string;
  receipt_url?: string;
  raw_prompt?: string;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Budget {
  id: string;
  category_id: string;
  monthly_limit: number;
  month: string; // YYYY-MM
}

export interface FinancialSummary {
  totalBalance: number;
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
