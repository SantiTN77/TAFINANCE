"use client";

import React, { useState } from "react";
import { TrendingUp, AlertTriangle, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";

interface SmartForecastCardProps {
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  onShowToast?: (msg: string) => void;
}

export const SmartForecastCard: React.FC<SmartForecastCardProps> = ({
  currentBalance,
  monthlyIncome,
  monthlyExpenses,
  onShowToast,
}) => {
  const { t, formatMoney } = useApp();
  const [activeScenario, setActiveScenario] = useState<"conservative" | "baseline" | "optimistic">("baseline");

  // Calculate daily burn rate
  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - dayOfMonth);

  const dailyBurn = monthlyExpenses > 0 ? monthlyExpenses / dayOfMonth : 0;
  
  const multiplier = activeScenario === "conservative" ? 1.25 : activeScenario === "optimistic" ? 0.8 : 1.0;
  const projectedExtraExpense = dailyBurn * remainingDays * multiplier;
  const projectedBalance = currentBalance - projectedExtraExpense;

  const isPositive = projectedBalance >= 0;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#141923] border border-white/[0.06] p-5 shadow-xl">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-[#8083ff]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#8083ff]/15 text-[#8083ff] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {t("smartForecastTitle")}
              </h3>
              <p className="text-[10px] text-slate-400">
                {t("smartForecastSubtitle")}
              </p>
            </div>
          </div>

          {/* Scenario tabs */}
          <div className="flex items-center bg-[#0a0e16] p-0.5 rounded-full border border-white/[0.06]">
            {(["conservative", "baseline", "optimistic"] as const).map((scen) => (
              <button
                key={scen}
                onClick={() => setActiveScenario(scen)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                  activeScenario === scen
                    ? "bg-[#8083ff] text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {scen === "conservative" ? "Cautela" : scen === "baseline" ? "Normal" : "Ahorro"}
              </button>
            ))}
          </div>
        </div>

        {/* Projection Metric */}
        <div className="flex items-baseline justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 font-medium">
              {t("projectedSurplus")}
            </span>
            <span
              className={`text-2xl font-black tabular-nums tracking-tight ${
                isPositive ? "text-[#4edea3]" : "text-rose-400"
              }`}
            >
              {formatMoney(projectedBalance)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs">
            {isPositive ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
                <span className="text-[11px] text-[#4edea3] font-semibold">Saludable</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px] text-rose-400 font-semibold">Ajuste sugerido</span>
              </>
            )}
          </div>
        </div>

        {/* Mini progress line */}
        <div className="w-full bg-[#0a0e16] h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPositive ? "bg-gradient-to-r from-[#8083ff] to-[#4edea3]" : "bg-rose-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(10, (currentBalance > 0 ? (projectedBalance / currentBalance) * 100 : 50)))}%` }}
          />
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
          <span>Quemado diario: ~{formatMoney(dailyBurn)}/día</span>
          <span>Días restantes en el mes: {remainingDays}</span>
        </div>
      </div>
    </section>
  );
};
