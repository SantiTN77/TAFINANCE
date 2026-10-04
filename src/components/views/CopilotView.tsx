"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  ArrowRight,
  TrendingUp,
  Wallet,
  CheckCircle2,
  DollarSign,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { Pocket, ParsedVoiceTransaction } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";
import { financeStore } from "@/lib/storage/finance-store";
import { matchCategory, todayStr } from "@/lib/finance/calc";

interface CopilotMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionCard?: {
    type: "pocket_deposit" | "transaction_register" | "summary" | "tip";
    title: string;
    description: string;
    pocketId?: string;
    amount?: number;
    parsedTx?: ParsedVoiceTransaction;
    executed?: boolean;
  };
}

interface CopilotViewProps {
  pockets: Pocket[];
  totalBalance: number;
  onTransferToPocket: (pocketId: string, amount: number) => Promise<boolean>;
  onShowToast: (msg: string) => void;
  onTransactionSaved?: () => void;
}

export const CopilotView: React.FC<CopilotViewProps> = ({
  pockets,
  totalBalance,
  onTransferToPocket,
  onShowToast,
  onTransactionSaved,
}) => {
  const { language, formatMoney } = useApp();
  const isEs = language === "es";

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: isEs
        ? "¡Hola! Soy tu Copiloto Financiero con Gemini AI. Puedes dictarme o escribirme cualquier movimiento (ej: 'Gasté 35 mil en almuerzo', 'Recibí 1.5 millones de nómina'), o preguntarme por tu balance o bolsillos."
        : "Hello! I am your Financial Copilot powered by Gemini AI. Dictate or type any movement (e.g. 'Spent $40 on lunch', 'Received $1500 salary') or ask about your balance and savings pockets.",
      timestamp: "Ahora",
    },
  ]);

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isProcessing) return;

    const userMsg: CopilotMessage = {
      id: "msg-" + Date.now(),
      sender: "user",
      text: cleanText,
      timestamp: "Ahora",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    try {
      // 1. Send to /api/voice/parse
      const res = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, today: todayStr(), categories: (await financeStore.getCategories()).map((c) => c.name) }),
      });

      let parsed: ParsedVoiceTransaction | null = null;
      if (res.ok) {
        parsed = await res.json();
      }

      let replyText = "";
      let actionCard: CopilotMessage["actionCard"] = undefined;

      const lower = cleanText.toLowerCase();

      // Check if it's a financial transaction movement
      if (parsed && parsed.amount > 0) {
        const isInc = parsed.type === "INCOME";
        replyText = isEs
          ? `He detectado un ${isInc ? "ingreso" : "gasto"} de ${formatMoney(parsed.amount)} clasificado en "${parsed.category}". Presiona el botón a continuación para registrarlo en tu bóveda.`
          : `Detected ${isInc ? "income" : "expense"} of ${formatMoney(parsed.amount)} categorized under "${parsed.category}". Tap below to save it to your vault.`;

        actionCard = {
          type: "transaction_register",
          title: `${isInc ? (isEs ? "Registrar Ingreso" : "Log Income") : (isEs ? "Registrar Gasto" : "Log Expense")}: ${formatMoney(parsed.amount)}`,
          description: `${parsed.description} • ${parsed.category}`,
          amount: parsed.amount,
          parsedTx: parsed,
          executed: false,
        };
      } else if (
        lower.includes("balance") ||
        lower.includes("saldo") ||
        lower.includes("cuánto tengo") ||
        lower.includes("cuanto tengo") ||
        lower.includes("how much")
      ) {
        replyText = isEs
          ? `Tu balance total neto consolidado en la bóveda es de ${formatMoney(totalBalance)}.`
          : `Your consolidated total net balance in the vault is ${formatMoney(totalBalance)}.`;
      } else if (
        lower.includes("ahorro") ||
        lower.includes("bolsillo") ||
        lower.includes("meta") ||
        lower.includes("pocket") ||
        lower.includes("save")
      ) {
        if (pockets.length > 0) {
          const targetPocket = pockets[0];
          replyText = isEs
            ? `Tienes ${pockets.length} bolsillos de ahorro activos. El bolsillo prioritario es "${targetPocket.name}" con ${formatMoney(targetPocket.current_amount)} de meta ${formatMoney(targetPocket.target_amount)}.`
            : `You have ${pockets.length} active pockets. Primary pocket is "${targetPocket.name}" with ${formatMoney(targetPocket.current_amount)} of ${formatMoney(targetPocket.target_amount)} goal.`;

          actionCard = {
            type: "pocket_deposit",
            title: isEs ? `Aportar $50.000 a ${targetPocket.name}` : `Deposit $50 to ${targetPocket.name}`,
            description: isEs ? "Aporte inteligente sugerido por la IA para tu meta." : "Smart AI suggestion for your goal.",
            pocketId: targetPocket.id,
            amount: 50000,
            executed: false,
          };
        } else {
          replyText = isEs
            ? "Aún no tienes bolsillos configurados en tu bóveda. Puedes crearlos en la pestaña 'Bolsillos' (ej: Fondo de Emergencia, Vacaciones, Tecnología)."
            : "You don't have any savings pockets configured yet. You can create one in the 'Pockets' tab.";
        }
      } else {
        replyText = isEs
          ? `Comprendido: "${cleanText}". Tu bóveda está al día con balance de ${formatMoney(totalBalance)}. Puedes dictarme gastos o ingresos en cualquier momento.`
          : `Understood: "${cleanText}". Your vault is up to date with balance of ${formatMoney(totalBalance)}. You can log expenses or incomes anytime.`;
      }

      const assistantMsg: CopilotMessage = {
        id: "msg-" + (Date.now() + 1),
        sender: "assistant",
        text: replyText,
        timestamp: "Ahora",
        actionCard,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: "msg-" + Date.now(),
          sender: "assistant",
          text: isEs
            ? "Estoy listo para registrar tus gastos. Prueba diciendo: 'Gasté 25 mil en almuerzo' o preguntando '¿Cuál es mi saldo?'"
            : "I am ready to log your expenses. Try saying: 'Spent 25 on lunch' or asking 'What is my balance?'",
          timestamp: "Ahora",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute Pocket Transfer Action
  const handleExecutePocketTransfer = async (
    msgId: string,
    pocketId: string,
    amount: number
  ) => {
    const success = await onTransferToPocket(pocketId, amount);
    if (success) {
      onShowToast(isEs ? `¡Aporte de ${formatMoney(amount)} completado con éxito!` : `Deposit of ${formatMoney(amount)} completed!`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.actionCard
            ? { ...m, actionCard: { ...m.actionCard, executed: true } }
            : m
        )
      );
    }
  };

  // Execute Transaction Register Action
  const handleExecuteRegisterTx = async (
    msgId: string,
    parsedTx: ParsedVoiceTransaction
  ) => {
    try {
      const categories = await financeStore.getCategories();
      const accounts = await financeStore.getAccounts();

      const matchedCat = matchCategory(categories, parsedTx.category, parsedTx.type, `${parsedTx.description} ${parsedTx.merchant || ""}`);
      const matchedAcc = accounts.find((a) => a.type !== "credit") || accounts[0];

      await financeStore.addTransaction({
        account_id: matchedAcc?.id,
        category_id: matchedCat?.id,
        type: parsedTx.type,
        amount: parsedTx.amount,
        currency: parsedTx.currency || "COP",
        description: parsedTx.description,
        merchant: parsedTx.merchant,
        raw_prompt: parsedTx.description,
        date: parsedTx.date || todayStr(),
      });

      onShowToast(
        isEs
          ? `¡${parsedTx.type === "INCOME" ? "Ingreso" : "Gasto"} de ${formatMoney(parsedTx.amount)} registrado!`
          : `Logged ${formatMoney(parsedTx.amount)} successfully!`
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.actionCard
            ? { ...m, actionCard: { ...m.actionCard, executed: true } }
            : m
        )
      );

      if (onTransactionSaved) {
        onTransactionSaved();
      }
    } catch (err) {
      console.error("Error registrando transacción desde Copilot:", err);
      onShowToast(isEs ? "Error al registrar en la bóveda" : "Error saving transaction");
    }
  };

  // Web Speech API Voice Dictation
  const toggleSpeech = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast(isEs ? "Reconocimiento de voz no soportado en este navegador" : "Voice not supported in this browser");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = isEs ? "es-CO" : "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        if (transcriptText) {
          setInput(transcriptText);
          handleSend(transcriptText);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const quickChips = isEs
    ? [
        "¿Cuánto tengo de saldo?",
        "Gasté 45 mil en comida",
        "Aportar a mis bolsillos",
      ]
    : [
        "What is my balance?",
        "Spent 45 on food",
        "Deposit to my pockets",
      ];

  return (
    <div className="flex flex-col h-[calc(100dvh-190px)] min-h-[420px] max-h-[760px] pb-2">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              {isEs ? "Copiloto IA Tafinance" : "Tafinance AI Copilot"}
            </h2>
            <p className="text-[10px] text-slate-400">
              {isEs ? "Dictado por voz & razonamiento financiero" : "Voice dictation & financial reasoning"}
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
          GEMINI 3.8 ONLINE
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 no-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 max-w-[88%] ${
              msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                msg.sender === "user"
                  ? "bg-slate-800 text-slate-300"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className="flex flex-col gap-1.5">
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  msg.sender === "user"
                    ? "bg-emerald-500 text-slate-950 font-semibold rounded-tr-none"
                    : "bg-card text-slate-200 border border-white/[0.06] rounded-tl-none"
                }`}
              >
                {msg.text}
              </div>

              {/* Action Card if present */}
              {msg.actionCard && (
                <div className="p-3 rounded-2xl bg-inset border border-emerald-500/30 shadow-md flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      {msg.actionCard.type === "transaction_register" ? (
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Wallet className="w-3.5 h-3.5 text-teal-400" />
                      )}
                      {msg.actionCard.title}
                    </span>
                    {msg.actionCard.executed && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {isEs ? "Registrado" : "Done"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {msg.actionCard.description}
                  </p>

                  {!msg.actionCard.executed && (
                    <button
                      onClick={() => {
                        if (msg.actionCard?.type === "transaction_register" && msg.actionCard.parsedTx) {
                          handleExecuteRegisterTx(msg.id, msg.actionCard.parsedTx);
                        } else if (msg.actionCard?.pocketId && msg.actionCard?.amount) {
                          handleExecutePocketTransfer(
                            msg.id,
                            msg.actionCard.pocketId,
                            msg.actionCard.amount
                          );
                        }
                      }}
                      className="mt-1 w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 shadow-md hover:opacity-95 transition-opacity"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isEs ? "Confirmar y Guardar en Bóveda" : "Confirm and Save"}</span>
                    </button>
                  )}
                </div>
              )}

              <span
                className={`text-[9px] text-slate-500 ${
                  msg.sender === "user" ? "text-right" : "text-left"
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-2 mr-auto items-center text-xs text-emerald-400">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            </div>
            <span>{isEs ? "Razonando con Gemini AI..." : "Processing with Gemini AI..."}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
        {quickChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="px-3 py-1.5 rounded-full bg-card border border-white/[0.06] text-[11px] text-slate-300 hover:text-white hover:border-emerald-500/40 whitespace-nowrap transition-colors shrink-0"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Form with Voice Dictation */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="relative flex items-center gap-2 pt-1"
      >
        <button
          type="button"
          onClick={toggleSpeech}
          className={`p-2.5 rounded-2xl border transition-all ${
            isListening
              ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
              : "bg-card border-white/[0.08] text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30"
          }`}
          title={isListening ? "Detener dictado" : "Hablar al Copiloto"}
        >
          {isListening ? <Mic className="w-4 h-4 text-rose-400" /> : <MicOff className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? (isEs ? "Escuchando... Di tu movimiento..." : "Listening...")
              : (isEs ? "Escribe o dicta: 'Gasté 30 mil en Uber'..." : "Type or dictate: 'Spent 30 on Uber'...")
          }
          className="flex-1 px-4 py-2.5 rounded-2xl bg-card border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
        />

        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="p-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold hover:opacity-95 disabled:opacity-40 transition-opacity"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
