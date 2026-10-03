"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  Repeat,
  Wallet,
  Calendar,
  Building,
  DollarSign,
  Tag,
} from "lucide-react";
import { Category, Account, Pocket, TransactionType } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";
import { useApp } from "@/lib/context/AppContext";

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  pockets?: Pocket[];
  onTransactionSaved: () => void;
}

export function NewTransactionModal({
  isOpen,
  onClose,
  categories,
  accounts,
  pockets = [],
  onTransactionSaved,
}: NewTransactionModalProps) {
  const { t, language } = useApp();
  const isEs = language === "es";

  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [pocketId, setPocketId] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<
    "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "YEARLY"
  >("MONTHLY");
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
        pocket_id: pocketId ? pocketId : undefined,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : undefined,
        date,
      });

      onTransactionSaved();
      onClose();

      // Reset form
      setAmount("");
      setDescription("");
      setMerchant("");
      setPocketId("");
      setIsRecurring(false);
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
          className="relative w-full max-w-md rounded-3xl bg-[#0B101D] border border-white/[0.1] shadow-2xl p-6 flex flex-col max-h-[92vh] overflow-y-auto"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>{isEs ? "Nueva Transacción / Recurrente" : "New Transaction / Recurring"}</span>
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
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
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{isEs ? "Gasto" : "Expense"}</span>
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
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{isEs ? "Ingreso" : "Income"}</span>
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                {isEs ? "Monto" : "Amount"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={isEs ? "Ej. 45000" : "Ex. 50"}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-base text-white font-extrabold placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  COP
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                {isEs ? "Descripción o Motivo" : "Description"}
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isEs ? "Ej. Arriendo, Salario quincenal, Supermercado..." : "Ex. Rent, Salary, Groceries..."}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Merchant */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                {isEs ? "Comercio o Pagador (Opcional)" : "Merchant or Payer (Optional)"}
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder={isEs ? "Ej. Netflix, Spotify, Inmobiliaria, Empresa..." : "Ex. Netflix, Spotify, Landlord, Employer..."}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Category & Pocket Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isEs ? "Categoría" : "Category"}
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-emerald-500/40"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0B101D] text-white">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isEs ? "Bolsillo Meta (Opcional)" : "Linked Pocket (Optional)"}
                </label>
                <select
                  value={pocketId}
                  onChange={(e) => setPocketId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-emerald-500/40"
                >
                  <option value="" className="bg-[#0B101D] text-slate-400">
                    {isEs ? "Sin bolsillo asignado" : "No pocket assigned"}
                  </option>
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0B101D] text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                {isEs ? "Fecha de Registro" : "Date"}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#12192B] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-emerald-500/40"
              />
            </div>

            {/* Recurring Section */}
            <div className="p-3.5 rounded-2xl bg-[#070A11] border border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-xs font-bold text-white block leading-tight">
                      {isEs ? "Compromiso / Fijo Recurrente" : "Recurring Commitment"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isEs ? "Suscripciones, salario periódico, arriendos, servicios" : "Subscriptions, salary, rent, bills"}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-slate-800 border-slate-700 focus:ring-cyan-400 cursor-pointer"
                />
              </div>

              {isRecurring && (
                <div className="pt-2 border-t border-white/[0.06] animate-in fade-in duration-200">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block mb-1">
                    {isEs ? "Frecuencia de Repetición" : "Recurrence Frequency"}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "WEEKLY" as const, label: isEs ? "Semanal" : "Weekly" },
                      { id: "BIWEEKLY" as const, label: isEs ? "Quincenal" : "Biweekly" },
                      { id: "MONTHLY" as const, label: isEs ? "Mensual" : "Monthly" },
                      { id: "YEARLY" as const, label: isEs ? "Anual" : "Yearly" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRecurrenceInterval(item.id)}
                        className={`py-1.5 px-1 rounded-xl text-[10px] font-bold transition-colors ${
                          recurrenceInterval === item.id
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                            : "bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 mt-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {isSaving
                  ? (isEs ? "Guardando en la Bóveda..." : "Saving...")
                  : isRecurring
                  ? (isEs ? "Guardar Movimiento Recurrente" : "Save Recurring Movement")
                  : (isEs ? "Registrar en Bóveda" : "Save Transaction")}
              </span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
