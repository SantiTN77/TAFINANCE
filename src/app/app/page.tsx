"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header/Header";
import { BottomNav, NavTab } from "@/components/navigation/BottomNav";
import { BalanceOverview } from "@/components/dashboard/BalanceOverview";
import { SmartForecastCard } from "@/components/dashboard/SmartForecastCard";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { PocketsView } from "@/components/views/PocketsView";
import { CopilotView } from "@/components/views/CopilotView";
import { ScanView } from "@/components/views/ScanView";
import { SettingsView } from "@/components/views/SettingsView";
import { VoiceModal } from "@/components/voice/VoiceModal";
import { NewTransactionModal } from "@/components/dashboard/NewTransactionModal";
import { financeStore } from "@/lib/storage/finance-store";
import { FinancialSummary, Transaction, Category, Account, Pocket } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";

export default function AppPage() {
  const { t, formatMoney } = useApp();

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const refreshData = useCallback(async () => {
    try {
      const [sum, txs, cats, accs, pocks] = await Promise.all([
        financeStore.getSummary(),
        financeStore.getTransactions(),
        financeStore.getCategories(),
        financeStore.getAccounts(),
        financeStore.getPockets(),
      ]);
      setSummary(sum);
      setTransactions(txs);
      setCategories(cats);
      setAccounts(accs);
      setPockets(pocks);
    } catch (err) {
      console.error("Error cargando datos de la bóveda:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Pocket Actions
  const handleAddPocket = async (pocketData: Omit<Pocket, "id" | "created_at">) => {
    await financeStore.createPocket(pocketData);
    await refreshData();
  };

  const handleDeletePocket = async (id: string) => {
    await financeStore.deletePocket(id);
    await refreshData();
  };

  const handleTransferToPocket = async (pocketId: string, amount: number) => {
    const success = await financeStore.transferToPocket(pocketId, amount);
    if (success) {
      await refreshData();
    }
    return success;
  };

  // Transaction Actions
  const handleDeleteTransaction = async (id: string) => {
    await financeStore.deleteTransaction(id);
    showToast("Transacción eliminada de la bóveda");
    await refreshData();
  };

  // Reset all data
  const handleClearAllData = async () => {
    await financeStore.clearAllData();
    await refreshData();
  };

  // Export JSON backup
  const handleExportBackup = async () => {
    const data = await financeStore.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tafinance-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Copia de seguridad descargada exitosamente");
  };

  // Lock vault session
  const handleLockSession = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/lock";
  };

  return (
    <div className="min-h-screen bg-[#070A11] text-slate-100 flex flex-col pb-28 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-500/90 text-slate-950 font-bold text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <Header onOpenVoice={() => setIsVoiceOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin mb-3" />
            <p className="text-xs text-slate-400">
              Conectando con la Bóveda Privada...
            </p>
          </div>
        ) : (
          <>
            {/* TAB: DASHBOARD */}
            {activeTab === "dashboard" && (
              <div className="flex flex-col gap-4">
                <BalanceOverview
                  summary={summary}
                  onOpenVoice={() => setIsVoiceOpen(true)}
                  onOpenScan={() => setActiveTab("scan")}
                />

                {/* 30-Day Smart Cashflow Forecast */}
                <SmartForecastCard
                  currentBalance={summary?.totalBalance ?? 0}
                  monthlyExpenses={summary?.monthlyExpenses ?? 0}
                  monthlyIncome={summary?.monthlyIncome ?? 0}
                  onShowToast={showToast}
                />

                {/* Trend Chart if user has transactions */}
                {summary && summary.netWorthHistory.length > 1 && (
                  <MonthlyTrendChart history={summary.netWorthHistory} />
                )}

                {/* Transaction Ledger */}
                <TransactionList
                  transactions={transactions}
                  categories={categories}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              </div>
            )}

            {/* TAB: POCKETS */}
            {activeTab === "pockets" && (
              <PocketsView
                pockets={pockets}
                onAddPocket={handleAddPocket}
                onDeletePocket={handleDeletePocket}
                onTransferToPocket={handleTransferToPocket}
                onShowToast={showToast}
              />
            )}

            {/* TAB: COPILOT IA */}
            {activeTab === "copilot" && (
              <CopilotView
                pockets={pockets}
                totalBalance={summary?.totalBalance ?? 0}
                onTransferToPocket={handleTransferToPocket}
                onShowToast={showToast}
              />
            )}

            {/* TAB: SCAN OCR */}
            {activeTab === "scan" && (
              <ScanView
                pockets={pockets}
                onReceiptProcessed={refreshData}
                onShowToast={showToast}
              />
            )}

            {/* TAB: SETTINGS */}
            {activeTab === "settings" && (
              <SettingsView
                onClearAllData={handleClearAllData}
                onExportBackup={handleExportBackup}
                onLockSession={handleLockSession}
                onShowToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickAdd={() => setIsAddOpen(true)}
      />

      {/* Global Voice Assistant Modal */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onTransactionSaved={refreshData}
      />

      {/* Global Quick Add Transaction Modal */}
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
