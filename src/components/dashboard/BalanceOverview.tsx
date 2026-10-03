"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Sparkles, Mic } from "lucide-react";
import { FinancialSummary } from "@/types/finance";

interface BalanceOverviewProps {
  summary: FinancialSummary | null;
  onOpenVoice: () => void;
  onOpenScan: () => void;
}

export function BalanceOverview({ summary, onOpenVoice, onOpenScan }: BalanceOverviewProps) {
  const totalBalance = summary?.totalBalance ?? 0;
  const monthlyIncome = summary?.monthlyIncome ?? 0;
  const monthlyExpenses = summary?.monthlyExpenses ?? 0;
  const savingsRate = summary?.savingsRate ?? 0;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Total Balance Hero Card */}
      <GlassCard glow className="p-6 relative overflow-hidden">
        {/* Ambient subtle glow background */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            Balance Total Neto
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-3 h-3" />
            {savingsRate.toFixed(0)}% Ahorro
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black tracking-tight text-white">
            ${totalBalance.toLocaleString("es-CO")}
          </span>
          <span className="text-xs font-semibold text-slate-400">COP</span>
        </div>

        {/* Quick Action Pills */}
        <div className="mt-5 grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
          <button
            onClick={onOpenVoice}
            className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>Hablar al Orbe</span>
          </button>
          <button
            onClick={onOpenScan}
            className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Escanear Recibo</span>
          </button>
        </div>
      </GlassCard>

      {/* Income vs Expenses Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Income Card */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400">Ingresos Mes</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-base font-extrabold text-emerald-400 tracking-tight">
              +${monthlyIncome.toLocaleString("es-CO")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Octubre 2026</p>
          </div>
        </GlassCard>

        {/* Expenses Card */}
        <GlassCard className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400">Gastos Mes</span>
            <div className="w-6 h-6 rounded-full bg-rose-500/10 flex items-center justify-center">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
            </div>
          </div>
          <div>
            <p className="text-base font-extrabold text-rose-400 tracking-tight">
              -${monthlyExpenses.toLocaleString("es-CO")}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Octubre 2026</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
