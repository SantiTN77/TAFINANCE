"use client";

import React from "react";
import { Mic, ShieldCheck, WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { usePwa } from "@/lib/pwa/PwaProvider";

interface HeaderProps {
  onOpenVoice?: () => void;
  syncState?: "idle" | "syncing" | "offline" | "error" | "local";
  pending?: number;
  onLock?: () => void;
}

export function Header({ onOpenVoice, syncState = "idle", pending = 0, onLock }: HeaderProps) {
  const { online } = usePwa();
  const offline = !online || syncState === "offline";

  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-xl bg-app/80 border-b border-white/[0.06] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-violet-500 p-[1.5px] shadow-[0_0_12px_rgba(16,185,129,0.3)] shrink-0">
            <div className="w-full h-full bg-app rounded-[10px] flex items-center justify-center">
              <span className="text-xs font-black text-white tracking-tighter">TA</span>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">TAFINANCE</h1>
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 truncate">
              {offline ? (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400">Sin conexión · se sincroniza al volver</span>
                </>
              ) : syncState === "syncing" || pending > 0 ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-sky2" />
                  <span>Sincronizando{pending > 0 ? ` (${pending})` : ""}…</span>
                </>
              ) : syncState === "error" ? (
                <>
                  <CloudOff className="w-3 h-3 text-rose-400" />
                  <span className="text-rose-400">Error de sincronización</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{syncState === "local" ? "Guardado en este dispositivo" : "Sincronizado"}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenVoice}
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-slate-900/80 border border-emerald-500/30 text-[11px] text-emerald-300 hover:bg-slate-800/80 transition-colors"
            aria-label="Registrar con voz"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium hidden min-[380px]:inline">Voz</span>
          </button>

          <button
            onClick={onLock}
            aria-label="Bloquear bóveda"
            title="Bloquear bóveda"
            className="w-9 h-9 rounded-full bg-slate-900/80 border border-white/[0.08] text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors flex items-center justify-center"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
