"use client";

import React from "react";
import { CalendarClock, CreditCard, Repeat, Scissors, Check, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { UpcomingItem } from "@/lib/finance/calc";
import { financeStore } from "@/lib/storage/finance-store";
import { useApp } from "@/lib/context/AppContext";

interface Props {
  items: UpcomingItem[];
  onOpenCards: () => void;
  onShowToast: (msg: string) => void;
}

const when = (n: number) => (n < 0 ? `venció hace ${-n} d` : n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`);

export function UpcomingPaymentsCard({ items, onOpenCards, onShowToast }: Props) {
  const { formatMoney } = useApp();
  const visible = items.filter((i) => i.daysLeft <= 30).slice(0, 6);
  if (visible.length === 0) return null;

  const register = async (item: UpcomingItem) => {
    if (!item.txId) return;
    await financeStore.executeRecurring(item.txId);
    onShowToast(`${item.title} registrado`);
  };

  return (
    <GlassCard className="p-5 w-full">
      <div className="flex items-center gap-1.5 mb-3.5">
        <CalendarClock className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Próximos pagos y fechas</h3>
      </div>

      <ul className="space-y-2">
        {visible.map((item) => {
          const Icon = item.kind === "card_due" ? CreditCard : item.kind === "card_cutoff" ? Scissors : Repeat;
          const urgent = item.overdue || item.daysLeft <= 1;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 p-2.5 rounded-2xl border ${
                urgent && item.kind !== "card_cutoff"
                  ? "bg-amber-500/10 border-amber-500/25"
                  : "bg-inset/70 border-white/[0.06]"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 text-slate-300">
                {item.overdue ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{item.title}</p>
                <p className={`text-[11px] ${item.overdue ? "text-rose-400" : "text-slate-400"}`}>
                  {when(item.daysLeft)} · {item.dueDate}
                  {item.amount ? ` · ${formatMoney(item.amount)}` : ""}
                </p>
              </div>
              {item.kind === "recurring" && item.type === "EXPENSE" && (
                <button
                  onClick={() => register(item)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3 h-3" /> Pagado
                </button>
              )}
              {item.kind === "recurring" && item.type === "INCOME" && (
                <button
                  onClick={() => register(item)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold shrink-0"
                >
                  Recibido
                </button>
              )}
              {item.kind === "card_due" && (
                <button
                  onClick={onOpenCards}
                  className="px-2.5 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[11px] font-bold shrink-0"
                >
                  Pagar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
