"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RefreshCw, Send, ArrowDownRight, ArrowUpRight, Sparkles, Tag, CreditCard, AlertCircle } from "lucide-react";
import { VoiceOrb } from "./VoiceOrb";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useFinance } from "@/hooks/useFinance";
import { ParsedVoiceTransaction } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";
import { matchCategory, todayStr } from "@/lib/finance/calc";
import { logger } from "@/lib/debug/logger";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionSaved: () => void;
}

export function VoiceModal({ isOpen, onClose, onTransactionSaved }: VoiceModalProps) {
  const { categories, accounts } = useFinance();
  const [manualInput, setManualInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Campos editables del resultado interpretado
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");

  const {
    state,
    transcript,
    volume,
    parsedResult,
    errorMsg,
    engine,
    startListening,
    stopListening,
    reset,
    parseTranscript,
  } = useVoiceAssistant({
    getCategories: () => categories.map((c) => c.name),
  });

  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === (parsedResult?.type === "INCOME" ? "INCOME" : "EXPENSE")),
    [categories, parsedResult?.type]
  );

  // Al llegar un resultado, precarga los campos editables
  useEffect(() => {
    if (!parsedResult) return;
    const matched = matchCategory(categories, parsedResult.category, parsedResult.type, `${parsedResult.description} ${parsedResult.merchant || ""}`);
    setCategoryId(matched?.id || "");
    setAmount(String(Math.round(parsedResult.amount)));
    setAccountId((prev) => prev || accounts.find((a) => a.type !== "credit")?.id || accounts[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedResult]);

  // Al cerrar: detener cualquier escucha
  useEffect(() => {
    if (!isOpen) {
      reset();
      setManualInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async (result: ParsedVoiceTransaction) => {
    const numeric = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!numeric || numeric <= 0) return;
    setIsSaving(true);
    try {
      await financeStore.addTransaction({
        account_id: accountId || accounts[0]?.id,
        category_id: categoryId || undefined,
        type: result.type,
        amount: numeric,
        currency: result.currency || "COP",
        description: result.description,
        merchant: result.merchant,
        raw_prompt: transcript || manualInput,
        date: result.date || todayStr(),
      });
      onTransactionSaved();
      reset();
      setManualInput("");
      onClose();
    } catch (err) {
      logger.error("voice", "Error guardando transacción", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    void parseTranscript(manualInput);
  };

  const hint = {
    idle: "Toca el orbe y habla. Ej: «Gasté 45 mil en comida con amigos»",
    listening: engine === "recorder" ? "Grabando… toca el orbe para terminar" : "Escuchando… di tu gasto o ingreso",
    processing: "Interpretando y categorizando…",
    success: "Revisa los datos y confirma",
    error: errorMsg || "Hubo un problema. Intenta de nuevo.",
  }[state];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-white/[0.1] shadow-2xl p-5 sm:p-6 flex flex-col items-center overflow-y-auto max-h-[94dvh] pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="w-full flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Voz en vivo</span>
            </div>
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              aria-label="Cerrar"
              className="w-9 h-9 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="my-2 flex flex-col items-center">
            <VoiceOrb
              state={state}
              volume={volume}
              size={170}
              onClick={() => {
                if (state === "listening") stopListening();
                else if (state === "idle" || state === "error") void startListening();
              }}
            />
            <p
              className={`mt-3 text-xs font-medium text-center max-w-[290px] ${
                state === "error" ? "text-rose-400" : "text-slate-400"
              }`}
              role="status"
            >
              {state === "error" && <AlertCircle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
              {hint}
            </p>
          </div>

          {(transcript || state === "listening") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-inset rounded-2xl p-3 border border-white/[0.06] mb-3 text-center"
            >
              <p className="text-[11px] text-slate-400 mb-0.5">Transcripción:</p>
              <p className="text-sm font-medium text-white italic">«{transcript || "Habla ahora…"}»</p>
            </motion.div>
          )}

          {parsedResult && state === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-gradient-to-b from-card to-inset rounded-2xl p-4 border border-emerald-500/30 mb-3 shadow-lg shadow-emerald-950/20"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Movimiento detectado
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    parsedResult.type === "INCOME"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {parsedResult.type === "INCOME" ? (
                    <><ArrowUpRight className="w-3 h-3" /> INGRESO</>
                  ) : (
                    <><ArrowDownRight className="w-3 h-3" /> GASTO</>
                  )}
                </span>
              </div>

              <label className="block text-[11px] text-slate-400 mb-1">Monto (COP)</label>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mb-2.5 px-3 py-2 rounded-xl bg-inset border border-white/[0.08] text-lg font-black text-white focus:outline-none focus:border-emerald-500/50"
              />

              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div>
                  <label className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Tag className="w-3 h-3" /> Categoría
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-inset border border-white/[0.08] text-xs text-white focus:outline-none"
                  >
                    {typeCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                    <CreditCard className="w-3 h-3" /> Cuenta
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl bg-inset border border-white/[0.08] text-xs text-white focus:outline-none"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-300 mb-3 truncate">{parsedResult.description}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    reset();
                    void startListening();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Repetir
                </button>
                <button
                  onClick={() => handleSave(parsedResult)}
                  disabled={isSaving}
                  className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  {isSaving ? "Guardando…" : "Confirmar y guardar"}
                </button>
              </div>
            </motion.div>
          )}

          {!(parsedResult && state === "success") && (
            <form onSubmit={handleManualSubmit} className="w-full flex gap-2 mt-1">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="O escribe: «Gasté 30 mil en Spotify»"
                className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-inset border border-white/[0.08] text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={!manualInput.trim() || state === "processing"}
                aria-label="Interpretar texto"
                className="px-3.5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
