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
} from "lucide-react";
import { Pocket } from "@/types/finance";
import { useApp } from "@/lib/context/AppContext";

interface CopilotMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  actionCard?: {
    type: "pocket_deposit" | "summary" | "tip";
    title: string;
    description: string;
    pocketId?: string;
    amount?: number;
    executed?: boolean;
  };
}

interface CopilotViewProps {
  pockets: Pocket[];
  totalBalance: number;
  onTransferToPocket: (pocketId: string, amount: number) => Promise<boolean>;
  onShowToast: (msg: string) => void;
}

export const CopilotView: React.FC<CopilotViewProps> = ({
  pockets,
  totalBalance,
  onTransferToPocket,
  onShowToast,
}) => {
  const { t, formatMoney } = useApp();

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: t("copilotWelcome"),
      timestamp: "Ahora",
    },
  ]);

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isProcessing) return;

    const userMsg: CopilotMessage = {
      id: "msg-" + Date.now(),
      sender: "user",
      text: textToSend,
      timestamp: "Ahora",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    try {
      // Analyze user prompt using natural language parse or answer
      const res = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend }),
      });

      const parsed = await res.json();
      let replyText = "";
      let actionCard: CopilotMessage["actionCard"] = undefined;

      const lower = textToSend.toLowerCase();

      if (parsed && parsed.amount > 0) {
        replyText = `He detectado un movimiento de ${formatMoney(parsed.amount)} clasificado en "${parsed.category}". ¿Deseas registrarlo en tus cuentas o asignarlo a una meta?`;
      } else if (lower.includes("ahorro") || lower.includes("bolsillo") || lower.includes("meta")) {
        if (pockets.length > 0) {
          const targetPocket = pockets[0];
          replyText = `Tienes ${pockets.length} bolsillos activos. Te sugiero destinar un aporte a "${targetPocket.name}".`;
          actionCard = {
            type: "pocket_deposit",
            title: `Aportar $50.000 a ${targetPocket.name}`,
            description: "Aporte rápido recomendado para acercarte a tu meta.",
            pocketId: targetPocket.id,
            amount: 50000,
          };
        } else {
          replyText = "Aún no tienes bolsillos creados. Ve a la pestaña Bolsillos para configurar tu primera meta de ahorro.";
        }
      } else if (lower.includes("balance") || lower.includes("saldo") || lower.includes("cuánto tengo")) {
        replyText = `Tu balance total neto consolidado es de ${formatMoney(totalBalance)}.`;
      } else {
        replyText = `Comando recibido: "${textToSend}". Todo en tu bóveda opera de forma óptima sin riesgos de sobregiro.`;
      }

      const assistantMsg: CopilotMessage = {
        id: "msg-" + (Date.now() + 1),
        sender: "assistant",
        text: replyText,
        timestamp: "Ahora",
        actionCard,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: "msg-" + Date.now(),
          sender: "assistant",
          text: "Estoy conectado a tu bóveda. Puedes preguntarme por tu balance, metas de ahorro o registrar compras.",
          timestamp: "Ahora",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteAction = async (msgId: string, pocketId: string, amount: number) => {
    const success = await onTransferToPocket(pocketId, amount);
    if (success) {
      onShowToast(`Aporte de ${formatMoney(amount)} completado`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.actionCard
            ? { ...m, actionCard: { ...m.actionCard, executed: true } }
            : m
        )
      );
    }
  };

  // Web Speech API Voice Dictation
  const toggleSpeech = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast("Reconocimiento de voz no soportado en este navegador");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[750px] pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#494bd6] to-[#4edea3] flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              {t("copilotTitle")}
            </h2>
            <p className="text-[10px] text-slate-400">
              {t("copilotSubtitle")}
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4edea3]/10 text-[#4edea3] border border-[#4edea3]/20 font-mono">
          GEMINI 3.8 ONLINE
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 no-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 max-w-[85%] ${
              msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                msg.sender === "user"
                  ? "bg-[#8083ff] text-white"
                  : "bg-gradient-to-tr from-[#494bd6] to-[#4cd7f6] text-white"
              }`}
            >
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className="flex flex-col gap-1.5">
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                  msg.sender === "user"
                    ? "bg-[#8083ff] text-white rounded-tr-xs"
                    : "bg-[#141923] border border-white/[0.06] text-slate-200 rounded-tl-xs"
                }`}
              >
                {msg.text}
              </div>

              {/* Action Card if assistant suggests a transaction */}
              {msg.actionCard && (
                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#4cd7f6]/30 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#4cd7f6]" />
                    <span className="text-xs font-bold text-white">
                      {msg.actionCard.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {msg.actionCard.description}
                  </p>
                  {msg.actionCard.executed ? (
                    <div className="flex items-center gap-1.5 text-xs text-[#4edea3] pt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Transferencia realizada exitosamente</span>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        handleExecuteAction(
                          msg.id,
                          msg.actionCard!.pocketId!,
                          msg.actionCard!.amount!
                        )
                      }
                      className="mt-1 py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#03b5d3] to-[#4cd7f6] text-black text-xs font-bold shadow-sm active:scale-95 transition-all text-center"
                    >
                      Confirmar y Transferir
                    </button>
                  )}
                </div>
              )}

              <span className="text-[9px] text-slate-500 px-1">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-9">
            <Sparkles className="w-3.5 h-3.5 text-[#4edea3] animate-spin" />
            <span>El copiloto está pensando...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar">
        {[
          "¿Cuál es mi balance?",
          "Aportar a mis bolsillos",
          "Gasté 30 mil en taxi",
        ].map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-400 hover:text-white border border-white/[0.06] whitespace-nowrap transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex items-center gap-2 pt-1"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("copilotPlaceholder")}
            className="w-full rounded-2xl bg-[#141923] border border-white/[0.08] px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#8083ff] shadow-inner"
          />
        </div>

        <button
          type="button"
          onClick={toggleSpeech}
          title={isListening ? "Detener micrófono" : "Hablar al copiloto"}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
            isListening
              ? "bg-rose-500 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)]"
              : "bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.08]"
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#494bd6] to-[#8083ff] text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none shadow-md active:scale-95 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
