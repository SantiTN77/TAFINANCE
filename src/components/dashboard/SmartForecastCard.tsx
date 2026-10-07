"use client";

import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";

interface SmartForecastCardProps {
  currentBalance: number;
  monthlyExpenses: number;
  /** Compromisos fijos aún no registrados que vencen antes de fin de mes. */
  pendingCommitments?: number;
}

const SCENARIOS = [
  { id: "conservative", label: "Cautela", mult: 1.25 },
  { id: "baseline", label: "Normal", mult: 1 },
  { id: "optimistic", label: "Ahorro", mult: 0.8 },
] as const;

export const SmartForecastCard: React.FC<SmartForecastCardProps> = ({
  currentBalance,
  monthlyExpenses,
  pendingCommitments = 0,
}) => {
  const { t, formatMoney } = useApp();
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]["id"]>("baseline");

  const now = new Date();
  const day = now.getDate();
  // Ventana mínima de 7 días: a inicio de mes un solo gasto no debe disparar la proyección
  const burnWindow = Math.max(7, day);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(0, daysInMonth - day);

  const dailyBurn = monthlyExpenses / burnWindow;
  const mult = SCENARIOS.find((s) => s.id === scenario)!.mult;
  const projected = currentBalance - dailyBurn * remainingDays * mult - pendingCommitments;
  const isPositive = projected >= 0;
  const ratio = currentBalance > 0 ? Math.max(0.05, Math.min(1, projected / currentBalance)) : 0.05;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-card border border-white/[0.06] p-5 shadow-xl">
      <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo2 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate">{t("smartForecastTitle")}</h3>
              <p className="text-[10px] text-slate-400 truncate">Cierre estimado del mes</p>
            </div>
          </div>

          <div className="flex items-center bg-inset p-0.5 rounded-full border border-white/[0.06] shrink-0">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  scenario === s.id ? "bg-indigo-500 text-on-accent shadow-sm font-semibold" : "text-slate-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2 pt-1">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-slate-400 font-medium">Patrimonio proyectado</span>
            <span className={`text-2xl font-black tabular-nums tracking-tight truncate ${isPositive ? "text-mint" : "text-rose-400"}`}>
              {formatMoney(projected)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs shrink-0">
            {isPositive ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-mint" />
                <span className="text-[11px] text-mint font-semibold">Saludable</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px] text-rose-400 font-semibold">Ajuste sugerido</span>
              </>
            )}
          </div>
        </div>

        <div className="w-full bg-inset h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPositive ? "bg-gradient-to-r from-indigo-400 to-emerald-400" : "bg-rose-500"
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 flex-wrap">
          <span>Gasto diario: ~{formatMoney(dailyBurn)}</span>
          <span>
            {remainingDays} días restantes
            {pendingCommitments > 0 ? ` · ${formatMoney(pendingCommitments)} en fijos por pagar` : ""}
          </span>
        </div>
      </div>
    </section>
  );
};
