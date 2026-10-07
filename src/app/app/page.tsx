"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header/Header";
import { BottomNav, NavTab } from "@/components/navigation/BottomNav";
import { BalanceOverview } from "@/components/dashboard/BalanceOverview";
import { SmartForecastCard } from "@/components/dashboard/SmartForecastCard";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { MonthlyTrendChart } from "@/components/dashboard/MonthlyTrendChart";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import { MonthSummaryCard } from "@/components/dashboard/MonthSummaryCard";
import { UpcomingPaymentsCard } from "@/components/dashboard/UpcomingPaymentsCard";
import { PocketsView } from "@/components/views/PocketsView";
import { AccountsView } from "@/components/views/AccountsView";
import { CopilotView } from "@/components/views/CopilotView";
import { ScanView } from "@/components/views/ScanView";
import { SettingsView } from "@/components/views/SettingsView";
import { VoiceModal } from "@/components/voice/VoiceModal";
import { NewTransactionModal } from "@/components/dashboard/NewTransactionModal";
import { financeStore } from "@/lib/storage/finance-store";
import { Pocket, Transaction } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";
import { useFinance } from "@/hooks/useFinance";
import { monthKey } from "@/lib/finance/calc";
import { logger } from "@/lib/debug/logger";

type PocketsTab = "pockets" | "accounts";

function AppContent() {
  const params = useSearchParams();
  const { language } = useApp();

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [pocketsTab, setPocketsTab] = useState<PocketsTab>("pockets");
  const [month, setMonth] = useState(monthKey());
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Datos en tiempo real: se recalculan solos con cada cambio del store
  const { summary, transactions, categories, accounts, pockets, upcoming, syncState, pending, hydrated } = useFinance(month);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Accesos directos del PWA: /app?action=voice | add
  useEffect(() => {
    const action = params.get("action");
    if (action === "voice") setIsVoiceOpen(true);
    if (action === "add") setIsAddOpen(true);
  }, [params]);

  useEffect(() => {
    logger.info("app", "Bóveda abierta", { tx: transactions.length, accounts: accounts.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddPocket = async (data: Omit<Pocket, "id" | "created_at">) => {
    await financeStore.createPocket(data);
  };
  const handleDeletePocket = async (id: string) => {
    await financeStore.deletePocket(id);
  };
  const handleTransferToPocket = async (pocketId: string, amount: number) => {
    return financeStore.transferToPocket(pocketId, amount);
  };
  const handlePayFromPocket = async (pocketId: string, accountId: string, amount: number) => {
    return financeStore.transferFromPocket(pocketId, accountId, amount);
  };
  const handleDeleteTransaction = async (id: string) => {
    await financeStore.deleteTransaction(id);
    showToast("Movimiento eliminado");
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(financeStore.exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tafinance-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Copia de seguridad descargada");
  };

  const handleLockSession = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    financeStore.wipeLocal(); // la caché local es del usuario que sale
    window.location.href = "/lock";
  };

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString(language === "es" ? "es-CO" : "en-US", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const pendingCommitments = upcoming
    .filter((i) => i.kind === "recurring" && i.type === "EXPENSE" && i.dueDate.startsWith(monthKey()))
    .reduce((s, i) => s + (i.amount || 0), 0);

  const narrow = "max-w-2xl mx-auto w-full";

  return (
    <div className="min-h-screen bg-app text-white flex flex-col pb-32 selection:bg-emerald-500/30">
      {toastMessage && (
        <div
          role="status"
          className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[70] max-w-[92vw] px-4 py-2 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl"
        >
          {toastMessage}
        </div>
      )}

      <Header onOpenVoice={() => setIsVoiceOpen(true)} syncState={syncState} pending={pending} onLock={handleLockSession} />

      <main className="flex-1 max-w-md md:max-w-3xl lg:max-w-5xl mx-auto w-full px-4 pt-4 flex flex-col gap-4">
        {!hydrated ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin mb-3" />
            <p className="text-xs text-slate-400">Sincronizando tu bóveda…</p>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="flex flex-col gap-4 min-w-0">
                  <BalanceOverview
                    summary={summary}
                    monthLabel={monthLabel}
                    onOpenVoice={() => setIsVoiceOpen(true)}
                    onOpenScan={() => setActiveTab("scan")}
                    onOpenAdd={() => setIsAddOpen(true)}
                  />
                  <UpcomingPaymentsCard
                    items={upcoming}
                    onShowToast={showToast}
                    onOpenCards={() => {
                      setPocketsTab("accounts");
                      setActiveTab("pockets");
                    }}
                  />
                  <SmartForecastCard
                    currentBalance={summary.totalBalance}
                    monthlyExpenses={summary.monthlyExpenses}
                    pendingCommitments={pendingCommitments}
                  />
                </div>

                <div className="flex flex-col gap-4 min-w-0">
                  <MonthlyTrendChart totalBalance={summary.totalBalance} transactions={transactions} />
                  <MonthSummaryCard
                    summary={summary}
                    month={month}
                    onMonthChange={setMonth}
                    pockets={pockets}
                    categories={categories}
                    onShowToast={showToast}
                  />
                  <CategoryBreakdownChart categories={summary.categoryBreakdown} />
                </div>

                <div className="lg:col-span-2 min-w-0">
                  <TransactionList
                    transactions={transactions}
                    categories={categories}
                    accounts={accounts}
                    onDeleteTransaction={handleDeleteTransaction}
                    onEditTransaction={(tx) => {
                      setEditingTx(tx);
                      setIsAddOpen(true);
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === "pockets" && (
              <div className={`${narrow} flex flex-col gap-4`}>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-card border border-white/[0.06]">
                  {([
                    ["pockets", "Bolsillos"],
                    ["accounts", "Cuentas y tarjetas"],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setPocketsTab(id)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
                        pocketsTab === id ? "bg-indigo-500 text-on-accent shadow" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {pocketsTab === "pockets" ? (
                  <PocketsView
                    pockets={pockets}
                    onAddPocket={handleAddPocket}
                    onDeletePocket={handleDeletePocket}
                    onTransferToPocket={handleTransferToPocket}
                    accounts={accounts}
                    onPayFromPocket={handlePayFromPocket}
                    onShowToast={showToast}
                  />
                ) : (
                  <AccountsView accounts={accounts} transactions={transactions} onShowToast={showToast} />
                )}
              </div>
            )}

            {activeTab === "copilot" && (
              <div className={narrow}>
                <CopilotView
                  pockets={pockets}
                  totalBalance={summary.totalBalance}
                  onTransferToPocket={handleTransferToPocket}
                  onShowToast={showToast}
                  onTransactionSaved={() => {}}
                />
              </div>
            )}

            {activeTab === "scan" && (
              <div className={narrow}>
                <ScanView pockets={pockets} onReceiptProcessed={() => {}} onShowToast={showToast} />
              </div>
            )}

            {activeTab === "settings" && (
              <div className={narrow}>
                <SettingsView
                  onClearAllData={async () => {
                    await financeStore.clearAllData();
                  }}
                  onExportBackup={handleExportBackup}
                  onLockSession={handleLockSession}
                  onShowToast={showToast}
                  syncState={syncState}
                  pending={pending}
                />
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} onQuickAdd={() => setIsAddOpen(true)} />

      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onTransactionSaved={() => showToast("Movimiento registrado")}
      />

      <NewTransactionModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingTx(null);
        }}
        categories={categories}
        accounts={accounts}
        pockets={pockets}
        editing={editingTx}
        onDelete={handleDeleteTransaction}
        onTransactionSaved={() => showToast(editingTx ? "Movimiento actualizado" : "Movimiento registrado")}
      />
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={null}>
      <AppContent />
    </Suspense>
  );
}
