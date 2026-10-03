"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header/Header";
import { BottomNav, NavTab } from "@/components/navigation/BottomNav";
import { BalanceOverview } from "@/components/dashboard/BalanceOverview";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { VoiceModal } from "@/components/voice/VoiceModal";
import { ReceiptScannerModal } from "@/components/scanner/ReceiptScannerModal";
import { NewTransactionModal } from "@/components/dashboard/NewTransactionModal";
import { financeStore } from "@/lib/storage/finance-store";
import { FinancialSummary, Transaction, Category, Account } from "@/types/finance";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      const [sum, txs, cats, accs] = await Promise.all([
        financeStore.getSummary(),
        financeStore.getTransactions(),
        financeStore.getCategories(),
        financeStore.getAccounts(),
      ]);
      setSummary(sum);
      setTransactions(txs);
      setCategories(cats);
      setAccounts(accs);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleDeleteTransaction = async (id: string) => {
    await financeStore.deleteTransaction(id);
    refreshData();
  };

  const handleTabChange = (tab: NavTab) => {
    if (tab === "voice") {
      setIsVoiceOpen(true);
    } else if (tab === "scan") {
      setIsScanOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A11] flex flex-col pb-28">
      {/* Top Header */}
      <Header onOpenVoice={() => setIsVoiceOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin mb-3" />
            <p className="text-xs text-slate-400">Cargando contabilidad de TAFINANCE...</p>
          </div>
        ) : (
          <>
            {/* TAB: DASHBOARD */}
            {activeTab === "dashboard" && (
              <>
                <BalanceOverview
                  summary={summary}
                  onOpenVoice={() => setIsVoiceOpen(true)}
                  onOpenScan={() => setIsScanOpen(true)}
                />

                {summary && <MonthlyTrendChart history={summary.netWorthHistory} />}

                <TransactionList
                  transactions={transactions}
                  categories={categories}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              </>
            )}

            {/* TAB: ANALYTICS / MÉTRICAS */}
            {activeTab === "analytics" && summary && (
              <>
                <CategoryBreakdownChart categories={summary.categoryBreakdown} />

                <BudgetProgress budgets={summary.budgetStatus} />

                <MonthlyTrendChart history={summary.netWorthHistory} />
              </>
            )}
          </>
        )}
      </main>

      {/* Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onQuickAdd={() => setIsAddOpen(true)}
      />

      {/* Modals */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onTransactionSaved={refreshData}
      />

      <ReceiptScannerModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onReceiptSaved={refreshData}
      />

      <NewTransactionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        categories={categories}
        accounts={accounts}
        onTransactionSaved={refreshData}
      />
    </div>
  );
}
