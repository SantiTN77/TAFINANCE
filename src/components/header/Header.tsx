"use client";

import React from "react";
import { Sparkles, ShieldCheck } from "lucide-react";

interface HeaderProps {
  onOpenVoice?: () => void;
}

export function Header({ onOpenVoice }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-[#070A11]/75 border-b border-white/[0.06] px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-violet-500 p-[1.5px] shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <div className="w-full h-full bg-[#070A11] rounded-[10px] flex items-center justify-center">
              <span className="text-xs font-black text-white tracking-tighter">TA</span>
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              TAFINANCE
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Contabilidad & Presupuesto IA</p>
          </div>
        </div>

        {/* AI & Live Indicator + Lock button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenVoice}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-emerald-500/30 text-[11px] text-emerald-300 hover:bg-slate-800/80 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="font-medium">Gemini 3.8</span>
          </button>

          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/lock";
            }}
            title="Bloquear bóveda"
            className="p-1.5 rounded-full bg-slate-900/80 border border-white/[0.08] text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
