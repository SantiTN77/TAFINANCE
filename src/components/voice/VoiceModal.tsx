"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RefreshCw, Send, ArrowDownRight, ArrowUpRight, Sparkles, Tag } from "lucide-react";
import { VoiceOrb } from "./VoiceOrb";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { ParsedVoiceTransaction } from "@/types/finance";
import { financeStore } from "@/lib/storage/finance-store";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionSaved: () => void;
}

export function VoiceModal({ isOpen, onClose, onTransactionSaved }: VoiceModalProps) {
  const [manualInput, setManualInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const {
    state,
    transcript,
    volume,
    parsedResult,
    errorMsg,
    startListening,
    stopListening,
    reset,
    parseTranscript,
  } = useVoiceAssistant({
    onParsed: () => {
      // Audio or vibration feedback could trigger here
    },
  });

  const handleSave = async (result: ParsedVoiceTransaction) => {
    setIsSaving(true);
    try {
      const categories = await financeStore.getCategories();
      const accounts = await financeStore.getAccounts();

      const matchedCat = categories.find((c) => c.name.toLowerCase() === result.category.toLowerCase()) || categories[0];
      const matchedAcc = accounts[0];

      await financeStore.addTransaction({
        account_id: matchedAcc?.id,
        category_id: matchedCat?.id,
        type: result.type,
        amount: result.amount,
        currency: result.currency || "COP",
        description: result.description,
        merchant: result.merchant,
        raw_prompt: transcript || manualInput,
        date: result.date || new Date().toISOString().split("T")[0],
      });

      onTransactionSaved();
      reset();
      onClose();
    } catch (err) {
      console.error("Error guardando transacción:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    parseTranscript(manualInput);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="relative w-full max-w-md rounded-3xl bg-[#0B101D] border border-white/[0.1] shadow-2xl p-6 flex flex-col items-center overflow-hidden"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Voz Live con Gemini
              </span>
            </div>
            <button
              onClick={() => {
                reset();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Central Animated Voice Orb */}
          <div className="my-4 flex flex-col items-center">
            <VoiceOrb
              state={state}
              volume={volume}
              size={180}
              onClick={() => {
                if (state === "listening") {
                  stopListening();
                } else if (state === "idle" || state === "error") {
                  startListening();
                }
              }}
            />

            <p className="mt-4 text-xs font-medium text-slate-400 text-center max-w-[260px]">
              {state === "idle" && "Toca el orbe para hablar. Ej: 'Gasté 45 mil en comida amigos'"}
              {state === "listening" && "Escuchando... Di tu gasto o ingreso claramente"}
              {state === "processing" && "Gemini está analizando y categorizando..."}
              {state === "success" && "¡Listo! Verifica y confirma tu transacción"}
              {state === "error" && (errorMsg || "Hubo un problema. Intenta de nuevo.")}
            </p>
          </div>

          {/* Live Transcript Bubble */}
          {(transcript || state === "listening") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-[#12192B] rounded-2xl p-3.5 border border-white/[0.06] mb-4 text-center"
            >
              <p className="text-xs text-slate-400 mb-1">Transcripción en tiempo real:</p>
              <p className="text-sm font-medium text-white italic">
                "{transcript || "Habla ahora..."}"
              </p>
            </motion.div>
          )}

          {/* Parsed Result Card */}
          {parsedResult && state === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-gradient-to-b from-[#141F36] to-[#0E1526] rounded-2xl p-4 border border-emerald-500/30 mb-4 shadow-lg shadow-emerald-950/20"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Transacción Detectada
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    parsedResult.type === "INCOME"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {parsedResult.type === "INCOME" ? (
                    <>
                      <ArrowUpRight className="w-3 h-3" /> INGRESO
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-3 h-3" /> GASTO
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs text-slate-400">Monto:</span>
                <span className="text-xl font-black text-white tracking-tight">
                  ${parsedResult.amount.toLocaleString("es-CO")} {parsedResult.currency}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" /> Categoría:
                </span>
                <span className="font-semibold text-slate-200">{parsedResult.category}</span>
              </div>

              <div className="flex items-center justify-between text-xs mb-4">
                <span className="text-slate-400">Descripción:</span>
                <span className="font-medium text-slate-300 text-right truncate max-w-[200px]">
                  {parsedResult.description}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                </button>
                <button
                  onClick={() => handleSave(parsedResult)}
                  disabled={isSaving}
                  className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  {isSaving ? "Guardando..." : "Confirmar y Guardar"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Fallback Text Input */}
          {!parsedResult && (
            <form onSubmit={handleManualSubmit} className="w-full flex gap-2 mt-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="O escribe: 'Gasté 30 mil en Spotify'"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#131B2E] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
