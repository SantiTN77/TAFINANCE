"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowDownRight, ArrowUpRight, Repeat, DollarSign, CreditCard, Pencil, Trash2 } from "lucide-react";
import { Category, Account, Pocket, Transaction, TransactionType } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";
import { useApp } from "@/lib/context/AppContext";
import { floatDaysFor, parseDate, todayStr } from "@/lib/finance/calc";
import { Sheet, inputCls, labelCls } from "@/components/ui/Sheet";
import { isEditableType } from "@/lib/finance/tx-edit";
import { logger } from "@/lib/debug/logger";

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  pockets?: Pocket[];
  onTransactionSaved: () => void;
  /** Si se pasa, el formulario edita este movimiento en lugar de crear uno nuevo. */
  editing?: Transaction | null;
  onDelete?: (id: string) => void;
}

type Interval = "MONTHLY" | "BIWEEKLY" | "WEEKLY" | "YEARLY";

export function NewTransactionModal({
  isOpen,
  onClose,
  categories,
  accounts,
  pockets = [],
  onTransactionSaved,
  editing = null,
  onDelete,
}: NewTransactionModalProps) {
  const { language, formatMoney } = useApp();
  const isEs = language === "es";

  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [pocketId, setPocketId] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<Interval>("MONTHLY");
  const [date, setDate] = useState(todayStr());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = !!editing;
  // Transferencias (y ajustes): solo monto, descripción y fecha; tipo y vínculos fijos
  const isTransfer = !!editing && !isEditableType(editing.type);
  /** Evita que un formulario nuevo herede los valores del último movimiento editado. */
  const wasEditing = useRef(false);

  const typeCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const account = accounts.find((a) => a.id === accountId);

  // Valores por defecto cuando se abre o cambian los datos
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setConfirmDelete(false);
    if (editing) {
      wasEditing.current = true;
      setType(editing.type);
      setAmount(String(editing.amount));
      setDescription(editing.description);
      setMerchant(editing.merchant || "");
      setCategoryId(editing.category_id || "");
      setAccountId(editing.account_id || "");
      setPocketId(editing.pocket_id || "");
      setIsRecurring(!!editing.is_recurring);
      setRecurrenceInterval(editing.recurrence_interval || "MONTHLY");
      setDate(editing.date);
      return;
    }
    if (wasEditing.current) {
      wasEditing.current = false;
      setType("EXPENSE");
      setAmount("");
      setDescription("");
      setMerchant("");
      setPocketId("");
      setIsRecurring(false);
    }
    setDate(todayStr());
    setAccountId((prev) =>
      prev && accounts.some((a) => a.id === prev)
        ? prev
        : accounts.find((a) => a.type !== "credit")?.id || accounts[0]?.id || ""
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editing?.id]);

  useEffect(() => {
    if (isTransfer) return;
    setCategoryId((prev) => (typeCategories.some((c) => c.id === prev) ? prev : typeCategories[0]?.id || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCategories]);

  const floatDays = account?.type === "credit" && type === "EXPENSE" ? floatDaysFor(account, parseDate(date)) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!numAmount || !description.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      if (editing) {
        await financeStore.updateTransaction(
          editing.id,
          isTransfer
            ? { amount: numAmount, description, merchant, date }
            : {
                type,
                amount: numAmount,
                description,
                merchant,
                category_id: categoryId || null,
                account_id: accountId || editing.account_id,
                pocket_id: pocketId || null,
                is_recurring: isRecurring,
                recurrence_interval: isRecurring ? recurrenceInterval : null,
                date,
              }
        );
        onTransactionSaved();
        onClose();
        return;
      }
      await financeStore.addTransaction({
        type,
        amount: numAmount,
        currency: "COP",
        description: description.trim(),
        merchant: merchant.trim() || undefined,
        category_id: categoryId || undefined,
        account_id: accountId || accounts[0]?.id,
        pocket_id: pocketId || undefined,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval : undefined,
        date,
      });
      onTransactionSaved();
      onClose();
      setAmount("");
      setDescription("");
      setMerchant("");
      setPocketId("");
      setIsRecurring(false);
    } catch (err: any) {
      logger.error("tx", "Error guardando movimiento", err);
      setError(err?.message || (isEs ? "No se pudo guardar" : "Could not save"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={
        <>
          {isEdit ? <Pencil className="w-4 h-4 text-emerald-400" /> : <DollarSign className="w-4 h-4 text-emerald-400" />}
          <span className="uppercase tracking-wider">
            {isEdit ? (isEs ? "Editar movimiento" : "Edit transaction") : isEs ? "Nuevo movimiento" : "New transaction"}
          </span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {isTransfer ? (
          <p className="text-[11px] text-slate-400 p-2.5 rounded-xl bg-inset border border-white/[0.06]">
            {isEs
              ? "Transferencia: puedes cambiar monto, descripción y fecha. Los saldos y bolsillos se recalculan solos."
              : "Transfer: you can change amount, description and date. Balances update automatically."}
          </p>
        ) : (
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-inset border border-white/[0.06]">
          {([
            ["EXPENSE", isEs ? "Gasto" : "Expense", ArrowDownRight, "bg-rose-500/20 text-rose-300 border-rose-500/30"],
            ["INCOME", isEs ? "Ingreso" : "Income", ArrowUpRight, "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"],
          ] as const).map(([val, label, Icon, active]) => (
            <button
              key={val}
              type="button"
              onClick={() => setType(val)}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border ${
                type === val ? active : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        )}

        <div>
          <label className={labelCls}>{isEs ? "Monto" : "Amount"}</label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="45000"
              className={`${inputCls} text-base font-extrabold pr-14`}
              autoFocus={!isEdit}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">COP</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>{isEs ? "Descripción" : "Description"}</label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isEs ? "Ej. Arriendo, Supermercado…" : "Ex. Rent, Groceries…"}
            className={inputCls}
          />
        </div>

        {!isTransfer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>{isEs ? "Cuenta o tarjeta" : "Account or card"}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type === "credit" ? "💳 " : ""}
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{isEs ? "Categoría" : "Category"}</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
              {typeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}

        {floatDays !== null && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-[11px] text-violet-300">
            <CreditCard className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {isEs
                ? `Con ${account?.name} tendrás ${floatDays} días para pagar esta compra. Mantén ese dinero invertido hasta entonces.`
                : `With ${account?.name} you get ${floatDays} days to pay this purchase.`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>{isEs ? "Fecha" : "Date"}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{isEs ? "Comercio (opcional)" : "Merchant (optional)"}</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Netflix, Éxito…"
              className={inputCls}
            />
          </div>
        </div>

        {!isTransfer && pockets.length > 0 && (
          <div>
            <label className={labelCls}>{isEs ? "Bolsillo vinculado (opcional)" : "Linked pocket (optional)"}</label>
            <select value={pocketId} onChange={(e) => setPocketId(e.target.value)} className={inputCls}>
              <option value="">{isEs ? "Sin bolsillo" : "None"}</option>
              {pockets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isTransfer && (
        <div className="p-3.5 rounded-2xl bg-inset border border-white/[0.08] space-y-2.5">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-cyan-400" />
              <span>
                <span className="text-xs font-bold text-white block leading-tight">
                  {isEs ? "Compromiso recurrente" : "Recurring"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isEs ? "Te avisamos antes de cada vencimiento" : "We remind you before each due date"}
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-5 h-5 accent-cyan-500"
            />
          </label>
          {isRecurring && (
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/[0.06]">
              {([
                ["WEEKLY", isEs ? "Semanal" : "Weekly"],
                ["BIWEEKLY", isEs ? "Quincenal" : "Biweekly"],
                ["MONTHLY", isEs ? "Mensual" : "Monthly"],
                ["YEARLY", isEs ? "Anual" : "Yearly"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRecurrenceInterval(id)}
                  className={`py-2 rounded-xl text-[10px] font-bold transition-colors ${
                    recurrenceInterval === id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-900 text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {error && (
          <p role="alert" className="text-[11px] text-rose-400 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          {isSaving
            ? isEs ? "Guardando…" : "Saving…"
            : isEdit
            ? isEs ? "Guardar cambios" : "Save changes"
            : isRecurring
            ? isEs ? "Guardar recurrente" : "Save recurring"
            : isEs ? "Registrar" : "Save"}
        </button>
        {isEdit && onDelete && (
          <button
            type="button"
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              onDelete(editing!.id);
              onClose();
            }}
            className={`w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              confirmDelete ? "bg-rose-500 text-on-accent" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete
              ? isEs ? "Toca de nuevo para eliminar" : "Tap again to delete"
              : isEs ? "Eliminar movimiento" : "Delete transaction"}
          </button>
        )}
        {amount && <p className="text-center text-[11px] text-slate-400">{formatMoney(parseFloat(amount) || 0)}</p>}
      </form>
    </Sheet>
  );
}
