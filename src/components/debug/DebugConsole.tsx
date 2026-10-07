"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Bug, X, Trash2, Copy } from "lucide-react";
import {
  LogEntry,
  LogLevel,
  clearLogs,
  getLogs,
  isDebugEnabled,
  setDebugEnabled,
  subscribeLogs,
} from "@/lib/debug/logger";

const LEVEL_STYLE: Record<LogLevel, string> = {
  debug: "text-slate-400",
  info: "text-sky2",
  warn: "text-amber-400",
  error: "text-rose-400",
};

/** Panel de depuración en vivo: se activa con ?debug=1 o desde Ajustes. */
const EMPTY_LOGS: LogEntry[] = [];

export function DebugConsole() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<LogLevel | "all">("all");

  useEffect(() => {
    setEnabled(isDebugEnabled());
    const on = (e: Event) => setEnabled(!!(e as CustomEvent).detail);
    window.addEventListener("tafinance:debug", on);
    return () => window.removeEventListener("tafinance:debug", on);
  }, []);

  const logs = useSyncExternalStore(
    subscribeLogs,
    () => getLogs(),
    () => EMPTY_LOGS
  );

  if (!enabled) return null;

  const visible = logs.filter((l) => filter === "all" || l.level === filter).slice(-150);
  const errors = logs.filter((l) => l.level === "error").length;

  const copy = () => {
    const text = logs
      .map((l) => `${new Date(l.ts).toISOString()} [${l.level}] ${l.scope}: ${l.msg}${l.data ? " " + JSON.stringify(l.data) : ""}`)
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Consola de depuración"
        className="fixed left-3 bottom-24 z-[60] w-10 h-10 rounded-full bg-card border border-white/[0.15] shadow-xl flex items-center justify-center text-amber-400"
      >
        <Bug className="w-4 h-4" />
        {errors > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-on-accent flex items-center justify-center">
            {errors}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 bottom-36 z-[60] max-h-[55dvh] rounded-2xl bg-card/95 backdrop-blur-xl border border-white/[0.15] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.08]">
            <span className="text-[11px] font-bold text-white mr-auto">Logs en vivo · {logs.length}</span>
            {(["all", "info", "warn", "error"] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setFilter(lv)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  filter === lv ? "bg-indigo2/30 text-white" : "text-slate-400"
                }`}
              >
                {lv}
              </button>
            ))}
            <button onClick={copy} aria-label="Copiar logs" className="p-1 text-slate-400 hover:text-white">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={clearLogs} aria-label="Limpiar" className="p-1 text-slate-400 hover:text-white">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setDebugEnabled(false);
                setOpen(false);
              }}
              aria-label="Cerrar depuración"
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-y-auto font-mono text-[10px] leading-snug p-2 space-y-1" data-testid="debug-log">
            {visible.length === 0 && <p className="text-slate-500 p-2">Sin eventos todavía.</p>}
            {visible.map((l) => (
              <div key={l.id} className="break-words">
                <span className="text-slate-500">{new Date(l.ts).toLocaleTimeString("es-CO", { hour12: false })} </span>
                <span className={LEVEL_STYLE[l.level]}>{l.scope}</span>{" "}
                <span className="text-slate-200">{l.msg}</span>
                {l.data !== undefined && (
                  <span className="text-slate-500"> {typeof l.data === "string" ? l.data : JSON.stringify(l.data)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
