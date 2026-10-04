"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Mic, Plus, PiggyBank, CreditCard } from "lucide-react";
import { FinancialSummary } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";

interface BalanceOverviewProps {
  summary: FinancialSummary | null;
  monthLabel: string;
  onOpenVoice: () => void;
  onOpenScan: () => void;
  onOpenAdd?: () => void;
}

export function BalanceOverview({ summary, monthLabel, onOpenVoice, onOpenScan, onOpenAdd }: BalanceOverviewProps) {
  const { language, formatMoney } = useApp();
  const isEs = language === "es";

  const total = summary?.totalBalance ?? 0;
  const income = summary?.monthlyIncome ?? 0;
  const expenses = summary?.monthlyExpenses ?? 0;
  const savingsRate = summary?.savingsRate ?? 0;
  const pocketsTotal = summary?.pocketsTotal ?? 0;
  const creditDebt = summary?.creditDebt ?? 0;
  const available = summary?.availableBalance ?? total;

  return (
    <div className="flex flex-col gap-3 w-full">
      <GlassCard glow className="p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            {isEs ? "Patrimonio neto" : "Net worth"}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-3 h-3" />
            {savingsRate.toFixed(0)}% {isEs ? "ahorro" : "savings"}
          </span>
        </div>

        <div className="relative mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span
            className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums ${total < 0 ? "text-rose-400" : "text-white"}`}
            data-testid="total-balance"
          >
            {formatMoney(total)}
          </span>
        </div>

        <div className="relative mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div className="min-w-0">
            <p className="text-slate-400">{isEs ? "Disponible" : "Available"}</p>
            <p className="font-bold text-white tabular-nums truncate">{formatMoney(available)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-slate-400 flex items-center gap-1"><PiggyBank className="w-3 h-3" />{isEs ? "Bolsillos" : "Pockets"}</p>
            <p className="font-bold text-teal-400 tabular-nums truncate">{formatMoney(pocketsTotal)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-slate-400 flex items-center gap-1"><CreditCard className="w-3 h-3" />{isEs ? "Tarjetas" : "Cards"}</p>
            <p className={`font-bold tabular-nums truncate ${creditDebt > 0 ? "text-violet-400" : "text-white"}`}>
              {creditDebt > 0 ? "-" : ""}
              {formatMoney(creditDebt)}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
          {onOpenAdd && (
            <button
              onClick={onOpenAdd}
              className="py-3 px-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px]">{isEs ? "Manual" : "Manual"}</span>
            </button>
          )}
          <button
            onClick={onOpenVoice}
            className="py-3 px-2 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px]">{isEs ? "Voz" : "Voice"}</span>
          </button>
          <button
            onClick={onOpenScan}
            className="py-3 px-2 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px]">{isEs ? "Escanear" : "Scan"}</span>
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400">{isEs ? "Ingresos" : "Income"}</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <p className="text-base font-extrabold text-emerald-400 tracking-tight tabular-nums truncate" data-testid="month-income">
            +{formatMoney(income)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{monthLabel}</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400">{isEs ? "Gastos" : "Expenses"}</span>
            <div className="w-6 h-6 rounded-full bg-rose-500/10 flex items-center justify-center">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>
          <p className="text-base font-extrabold text-rose-400 tracking-tight tabular-nums truncate" data-testid="month-expenses">
            -{formatMoney(expenses)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">{monthLabel}</p>
        </GlassCard>
      </div>
    </div>
  );
}
