"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, PiggyBank, Target, Plus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Sheet, inputCls, labelCls } from "@/components/ui/Sheet";
import { Category, FinancialSummary, Pocket } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";
import { monthKey, shiftMonth } from "@/lib/finance/calc";
import { useApp } from "@/lib/context/AppContext";
import { BudgetProgress } from "./BudgetProgress";

interface Props {
  summary: FinancialSummary;
  month: string;
  onMonthChange: (m: string) => void;
  pockets: Pocket[];
  categories: Category[];
  onShowToast: (msg: string) => void;
}

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function MonthSummaryCard({ summary, month, onMonthChange, pockets, categories, onShowToast }: Props) {
  const { formatMoney } = useApp();
  const current = monthKey();
  const isCurrent = month === current;
  const isFuture = month > current;
  const [saveOpen, setSaveOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [pocketId, setPocketId] = useState("");
  const [saveAmount, setSaveAmount] = useState("");
  const [budgetCat, setBudgetCat] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");

  const net = summary.netFlow ?? summary.monthlyIncome - summary.monthlyExpenses;
  const surplus = Math.max(0, net);

  // Proyección del cierre si es el mes en curso
  const now = new Date();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = now.getDate();
  const projectedExpenses = isCurrent && day > 0 ? (summary.monthlyExpenses / day) * dim : summary.monthlyExpenses;

  const openSave = () => {
    setPocketId(pockets[0]?.id || "");
    setSaveAmount(String(Math.round(surplus)));
    setSaveOpen(true);
  };

  const submitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(saveAmount.replace(/[^0-9.]/g, ""));
    if (!pocketId || !n) return;
    const ok = await financeStore.transferToPocket(pocketId, n);
    onShowToast(ok ? `${formatMoney(n)} apartados en tu bolsillo` : "No se pudo apartar el dinero");
    if (ok) setSaveOpen(false);
  };

  const submitBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(budgetLimit.replace(/[^0-9.]/g, ""));
    if (!budgetCat || !n) return;
    await financeStore.setBudget(budgetCat, n, month);
    onShowToast("Presupuesto guardado");
    setBudgetOpen(false);
    setBudgetLimit("");
  };

  const expenseCats = categories.filter((c) => c.type === "EXPENSE");

  return (
    <>
      <GlassCard className="p-5 w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4 text-indigo2" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cierre de mes</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMonthChange(shiftMonth(month, -1))}
              aria-label="Mes anterior"
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMonthChange(current)}
              className="px-2.5 text-[11px] font-semibold text-white min-w-[110px] text-center"
            >
              {monthLabel(month)}
            </button>
            <button
              onClick={() => onMonthChange(shiftMonth(month, 1))}
              disabled={isCurrent}
              aria-label="Mes siguiente"
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-300 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Ingresos" value={formatMoney(summary.monthlyIncome)} tone="text-emerald-400" />
          <Stat label="Gastos" value={formatMoney(summary.monthlyExpenses)} tone="text-rose-400" />
          <Stat label="Resultado" value={formatMoney(net)} tone={net >= 0 ? "text-emerald-400" : "text-rose-400"} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-inset/80 border border-white/[0.06]">
            <p className="text-slate-400">Patrimonio al inicio</p>
            <p className="font-bold text-white tabular-nums">{formatMoney(summary.openingBalance ?? 0)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-inset/80 border border-white/[0.06]">
            <p className="text-slate-400">{isCurrent ? "Patrimonio hoy" : "Patrimonio al cierre"}</p>
            <p className="font-bold text-white tabular-nums">{formatMoney(summary.closingBalance ?? 0)}</p>
          </div>
        </div>

        {isCurrent && summary.monthlyExpenses > 0 && (
          <p className="mt-3 text-[11px] text-slate-400">
            Con tu ritmo actual cerrarás el mes con unos <b className="text-white">{formatMoney(projectedExpenses)}</b> en gastos.
          </p>
        )}

        {!isFuture && surplus > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="text-[11px] text-emerald-300">
              <p className="font-bold">Te sobraron {formatMoney(surplus)} este mes</p>
              <p className="text-emerald-300/80">
                {pockets.length ? "Apártalos en un bolsillo para que no se diluyan." : "Crea un bolsillo para apartarlos."}
              </p>
            </div>
            {pockets.length > 0 && (
              <button
                onClick={openSave}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95"
              >
                <PiggyBank className="w-3.5 h-3.5" /> Apartar
              </button>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <Target className="w-3.5 h-3.5 text-violet-400" /> Presupuestos de {monthLabel(month).split(" ")[0].toLowerCase()}
          </span>
          <button
            onClick={() => {
              setBudgetCat(expenseCats[0]?.id || "");
              setBudgetOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[11px] font-bold flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Fijar
          </button>
        </div>
      </GlassCard>

      {summary.budgetStatus.length > 0 && <BudgetProgress budgets={summary.budgetStatus} monthLabel={monthLabel(month)} />}

      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title="Apartar excedente">
        <form onSubmit={submitSave} className="space-y-3.5">
          <div>
            <label className={labelCls}>Bolsillo</label>
            <select className={inputCls} value={pocketId} onChange={(e) => setPocketId(e.target.value)}>
              {pockets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto</label>
            <input className={inputCls} inputMode="numeric" value={saveAmount} onChange={(e) => setSaveAmount(e.target.value)} />
          </div>
          <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold">
            Apartar
          </button>
        </form>
      </Sheet>

      <Sheet open={budgetOpen} onClose={() => setBudgetOpen(false)} title="Fijar presupuesto mensual">
        <form onSubmit={submitBudget} className="space-y-3.5">
          <div>
            <label className={labelCls}>Categoría</label>
            <select className={inputCls} value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)}>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Límite del mes</label>
            <input className={inputCls} inputMode="numeric" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="500000" autoFocus />
          </div>
          <button type="submit" className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold">
            Guardar presupuesto
          </button>
        </form>
      </Sheet>
    </>
  );
}

function Stat({ label, value: raw, tone }: { label: string; value: string; tone: string }) {
  const value = raw.replace(/\s?[A-Z]{3}$/, ""); // sin sufijo de moneda: cabe en 3 columnas en móvil
  return (
    <div className="p-2.5 rounded-xl bg-inset/80 border border-white/[0.06] min-w-0">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className={`text-xs font-extrabold tabular-nums truncate ${tone}`}>{value}</p>
    </div>
  );
}
