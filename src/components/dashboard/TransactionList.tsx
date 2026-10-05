"use client";

import React, { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Transaction, Category, Account } from "@/types/finance";
import { Search, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Trash2, Mic, Repeat, CreditCard, Pencil } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { todayStr, addDays, toDateStr } from "@/lib/finance/calc";

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onDeleteTransaction: (id: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
}

type Filter = "ALL" | "EXPENSE" | "INCOME" | "TRANSFER";

function dayLabel(date: string): string {
  const today = todayStr();
  if (date === today) return "Hoy";
  if (date === toDateStr(addDays(new Date(), -1))) return "Ayer";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
}

export function TransactionList({ transactions, categories, accounts, onDeleteTransaction, onEditTransaction }: TransactionListProps) {
  const { formatMoney } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<Filter>("ALL");
  const [limit, setLimit] = useState(30);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return transactions.filter((t) => {
      const matchesSearch =
        !q ||
        t.description.toLowerCase().includes(q) ||
        (t.merchant && t.merchant.toLowerCase().includes(q)) ||
        (t.raw_prompt && t.raw_prompt.toLowerCase().includes(q));
      return matchesSearch && (filterType === "ALL" || t.type === filterType);
    });
  }, [transactions, searchTerm, filterType]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.slice(0, limit).forEach((t) => map.set(t.date, [...(map.get(t.date) || []), t]));
    return [...map.entries()];
  }, [filtered, limit]);

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Movimientos</h3>
        <span className="text-[11px] text-slate-400">{filtered.length} registros</span>
      </div>

      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por comercio o descripción…"
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-card/80 border border-white/[0.08] text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {([
          ["ALL", "Todos"],
          ["EXPENSE", "Gastos"],
          ["INCOME", "Ingresos"],
          ["TRANSFER", "Transferencias"],
        ] as const).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors whitespace-nowrap ${
              filterType === type
                ? "bg-slate-800 text-white border border-white/[0.15]"
                : "bg-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="p-6 text-center text-xs text-slate-400">
          {transactions.length === 0
            ? "Aún no tienes movimientos. Registra el primero con la voz o el botón +."
            : "No se encontraron transacciones."}
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, txs]) => (
            <section key={date}>
              <h4 className="text-[11px] font-semibold text-slate-400 capitalize mb-1.5 px-1">{dayLabel(date)}</h4>
              <div className="space-y-2">
                {txs.map((tx) => {
                  const category = categories.find((c) => c.id === tx.category_id);
                  const account = accounts.find((a) => a.id === tx.account_id);
                  const toAccount = accounts.find((a) => a.id === tx.to_account_id);
                  const isAdjust = tx.type === "ADJUSTMENT";
                  // Un ajuste se muestra con el signo de su efecto, pero no es ingreso/gasto del mes
                  const isIncome = tx.type === "INCOME" || (isAdjust && !!tx.to_account_id);
                  const isTransfer = tx.type === "TRANSFER";
                  const tone = isTransfer
                    ? "bg-sky-500/15 text-sky2 border-sky-500/25"
                    : isIncome
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                    : "bg-rose-500/15 text-rose-400 border-rose-500/25";
                  const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowUpRight : ArrowDownRight;
                  return (
                    <GlassCard key={tx.id} className="p-3.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onEditTransaction?.(tx)}
                        disabled={!onEditTransaction}
                        className="flex items-center gap-3 min-w-0 text-left flex-1"
                        aria-label={`Editar ${tx.merchant || tx.description}`}
                      >
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 border ${tone}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{tx.merchant || tx.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                              {isTransfer ? (toAccount ? `→ ${toAccount.name}` : "Transferencia") : isAdjust ? "Ajuste de saldo" : category?.name || "Sin categoría"}
                            </span>
                            {account && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded bg-white/[0.05] text-slate-300">
                                {account.type === "credit" && <CreditCard className="w-2.5 h-2.5" />}
                                {account.name}
                              </span>
                            )}
                            {tx.is_recurring && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <Repeat className="w-2.5 h-2.5" /> fijo
                              </span>
                            )}
                            {tx.raw_prompt && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Mic className="w-2.5 h-2.5" /> IA
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span
                          className={`text-xs font-black tracking-tight tabular-nums ${
                            isTransfer ? "text-sky2" : isIncome ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isTransfer ? "" : isIncome ? "+" : "-"}
                          {formatMoney(Number(tx.amount))}
                        </span>
                        {confirmId === tx.id ? (
                          <button
                            onClick={() => {
                              onDeleteTransaction(tx.id);
                              setConfirmId(null);
                            }}
                            onBlur={() => setConfirmId(null)}
                            autoFocus
                            className="px-2 py-1 rounded-lg bg-rose-500 text-on-accent text-[10px] font-bold"
                          >
                            ¿Borrar?
                          </button>
                        ) : (
                          <>
                          {onEditTransaction && (
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-2 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors"
                              aria-label="Editar movimiento"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmId(tx.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                            aria-label="Eliminar movimiento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          </>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          ))}
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 30)}
              className="w-full py-2.5 rounded-2xl bg-white/[0.04] text-xs font-semibold text-slate-300 hover:bg-white/[0.08]"
            >
              Ver más ({filtered.length - limit})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
