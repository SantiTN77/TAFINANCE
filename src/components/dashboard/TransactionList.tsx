"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Transaction, Category } from "@/types/finance";
import { Search, ArrowDownRight, ArrowUpRight, Trash2, Mic, Receipt, Tag } from "lucide-react";

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onDeleteTransaction: (id: string) => void;
}

export function TransactionList({
  transactions,
  categories,
  onDeleteTransaction,
}: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.merchant && t.merchant.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.raw_prompt && t.raw_prompt.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "ALL" || t.type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Title & Filter Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
          Movimientos Recientes
        </h3>
        <span className="text-[11px] text-slate-400">
          {filteredTransactions.length} registros
        </span>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por comercio, descripción..."
          className="w-full pl-9 pr-4 py-2 rounded-2xl bg-[#0D1322]/80 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5">
        {(["ALL", "EXPENSE", "INCOME"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors ${
              filterType === type
                ? "bg-slate-800 text-white border border-white/[0.15]"
                : "bg-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {type === "ALL" ? "Todos" : type === "EXPENSE" ? "Gastos" : "Ingresos"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filteredTransactions.length === 0 ? (
          <GlassCard className="p-6 text-center text-xs text-slate-400">
            No se encontraron transacciones.
          </GlassCard>
        ) : (
          filteredTransactions.map((tx) => {
            const category = categories.find((c) => c.id === tx.category_id);
            const isIncome = tx.type === "INCOME";

            return (
              <GlassCard
                key={tx.id}
                className="p-3.5 flex items-center justify-between hover:bg-[#12192B]/80 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Category / Type Icon */}
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      isIncome
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>

                  {/* Texts */}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {tx.merchant || tx.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {category?.name || "General"}
                      </span>
                      <span className="text-[10px] text-slate-600">•</span>
                      <span className="text-[10px] text-slate-500">{tx.date}</span>
                      {tx.raw_prompt && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Mic className="w-2.5 h-2.5" /> IA
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount & Delete */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-xs font-black tracking-tight ${
                      isIncome ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isIncome ? "+" : "-"}${Number(tx.amount).toLocaleString("es-CO")}
                  </span>
                  <button
                    onClick={() => onDeleteTransaction(tx.id)}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-opacity"
                    aria-label="Eliminar transacción"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
