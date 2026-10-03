"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Target, AlertTriangle } from "lucide-react";

interface BudgetProgressProps {
  budgets: {
    categoryId: string;
    categoryName: string;
    spent: number;
    limit: number;
    percentage: number;
  }[];
}

export function BudgetProgress({ budgets }: BudgetProgressProps) {
  if (!budgets || budgets.length === 0) return null;

  return (
    <GlassCard className="p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-violet-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Control de Presupuestos
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">Octubre 2026</span>
      </div>

      <div className="space-y-3.5">
        {budgets.map((b) => {
          const isWarning = b.percentage >= 80 && b.percentage < 100;
          const isOver = b.percentage >= 100;

          return (
            <div key={b.categoryId} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  {b.categoryName}
                  {isOver && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                </span>
                <span className="text-[11px] text-slate-400">
                  <span className="font-semibold text-white">
                    ${b.spent.toLocaleString("es-CO")}
                  </span>{" "}
                  / ${b.limit.toLocaleString("es-CO")}
                </span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOver
                      ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                      : isWarning
                      ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                      : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  }`}
                  style={{ width: `${Math.min(100, b.percentage)}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{b.percentage.toFixed(0)}% consumido</span>
                <span>
                  {isOver
                    ? "¡Presupuesto superado!"
                    : `$${(b.limit - b.spent).toLocaleString("es-CO")} disponible`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
