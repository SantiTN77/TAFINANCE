"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Category, Account, TransactionType } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  onTransactionSaved: () => void;
}

export function NewTransactionModal({
  isOpen,
  onClose,
  categories,
  accounts,
  onTransactionSaved,
}: NewTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, ""));
    if (!numAmount || !description.trim()) return;

    setIsSaving(true);
    try {
      await financeStore.addTransaction({
        type,
        amount: numAmount,
        currency: "COP",
        description: description.trim(),
        merchant: merchant.trim() || undefined,
        category_id: categoryId || categories[0]?.id,
        account_id: accountId || accounts[0]?.id,
        date,
      });

      onTransactionSaved();
      onClose();
      // Reset form
      setAmount("");
      setDescription("");
      setMerchant("");
    } catch (err) {
      console.error("Error guardando:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-md rounded-3xl bg-[#0B101D] border border-white/[0.1] shadow-2xl p-6 flex flex-col"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Nueva Transacción
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#070A11] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setType("EXPENSE")}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  type === "EXPENSE"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" /> Gasto
              </button>
              <button
                type="button"
                onClick={() => setType("INCOME")}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  type === "INCOME"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" /> Ingreso
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Monto (COP)</label>
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 45000"
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Descripción</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Almuerzo amigos"
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Merchant */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Comercio (Opcional)</label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="Ej. Bistro, Spotify, Carulla..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-emerald-500/40"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#0B101D] text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 mt-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              {isSaving ? "Guardando..." : "Registrar Transacción"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
